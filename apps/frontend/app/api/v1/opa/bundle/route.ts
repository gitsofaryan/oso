import { type NextRequest, NextResponse } from "next/server";
import { getSystemCredentials } from "@/lib/auth/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCatalogName } from "@/lib/dynamic-connectors";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { packTar } from "modern-tar";

const gzipAsync = promisify(gzip);

type SharedSchemas = Record<string, Record<string, string[]>>; // orgId -> catalog -> [schemas]

const PAGE_SIZE = 1000;
const MANIFEST_CONTENT = JSON.stringify({
  roots: ["shared_schemas"],
});

async function fetchSharedSchemas(): Promise<SharedSchemas> {
  const supabase = createAdminClient();

  const sharedSchemas: Record<string, Record<string, string[]>> = {};
  let offset = 0;
  let hasMoreItems = true;

  // Supabase returns at most 1000 rows per request, so we paginate
  while (hasMoreItems) {
    const { data, error } = await supabase
      .from("resource_permissions")
      .select(
        "org_id, datasets(id, org_id, dataset_type), dynamic_connectors(org_id, connector_name)",
      )
      .not("dataset_id", "is", null)
      .not("org_id", "is", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    for (const row of data) {
      const subscriberOrgId = row.org_id;
      const dataset = row.datasets;
      if (!subscriberOrgId || !dataset) continue;

      // Derive catalog
      const catalog =
        dataset.dataset_type === "DATA_CONNECTION" && row.dynamic_connectors
          ? getCatalogName(row.dynamic_connectors)
          : "user_shared";

      // Derive schema: org_{owner_org_id}__{dataset_id}
      const schema = `org_${dataset.org_id}__${dataset.id}`;

      if (!sharedSchemas[subscriberOrgId]) {
        sharedSchemas[subscriberOrgId] = {};
      }
      if (!sharedSchemas[subscriberOrgId][catalog]) {
        sharedSchemas[subscriberOrgId][catalog] = [];
      }
      if (!sharedSchemas[subscriberOrgId][catalog].includes(schema)) {
        sharedSchemas[subscriberOrgId][catalog].push(schema);
      }
    }

    hasMoreItems = data.length >= PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return sharedSchemas;
}

async function buildTarGz(dataJson: string): Promise<Buffer> {
  const content = new TextEncoder().encode(dataJson);
  const manifestContent = new TextEncoder().encode(MANIFEST_CONTENT);

  const tarBuffer = await packTar([
    { header: { name: "data.json", size: content.byteLength }, body: content },
    {
      header: { name: ".manifest", size: manifestContent.byteLength },
      body: manifestContent,
    },
  ]);

  return Buffer.from(await gzipAsync(tarBuffer));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const systemCredentials = await getSystemCredentials(request);
  if (!systemCredentials) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const sharedSchemas = await fetchSharedSchemas();
    const dataJson = JSON.stringify({ shared_schemas: sharedSchemas });

    // Compute ETag from data content (deterministic for same data)
    const etag = `"${createHash("sha256").update(dataJson).digest("hex").slice(0, 16)}"`;

    // ETag / conditional GET
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    const tarGzBuffer = await buildTarGz(dataJson);

    return new NextResponse(new Uint8Array(tarGzBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": tarGzBuffer.length.toString(),
        ETag: etag,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    logger.error("/api/v1/opa/bundle: Failed to build bundle", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
