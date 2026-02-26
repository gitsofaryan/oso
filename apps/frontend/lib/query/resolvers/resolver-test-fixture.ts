import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_KEY, SUPABASE_URL } from "@/lib/config";
import type { Database } from "@/lib/types/supabase";
import * as crypto from "crypto";

export interface ResolverFixtureData {
  adminSupabase: ReturnType<typeof createClient<Database>>;
  testUserId: string;
  randomSuffix: string;
  orgs: Record<string, { name: string; id: string }>;
  /** Map from org ref (org_a, org_b, ...) to array of 3 dataset IDs [USER_MODEL, DATA_CONNECTION, DATA_INGESTION] */
  orgDatasets: Record<string, string[]>;
  permissionIds: string[];
}

export async function setup(): Promise<ResolverFixtureData> {
  const adminSupabase = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    {
      auth: { storageKey: "resolver-fixture-auth" },
    },
  );

  const TEST_USER_ID = crypto.randomUUID();
  const RANDOM_SUFFIX = crypto.randomBytes(4).toString("hex");
  const orgs: Record<string, { name: string; id: string }> = {
    org_a: { name: `org_a_${RANDOM_SUFFIX}`, id: crypto.randomUUID() },
    org_b: { name: `org_b_${RANDOM_SUFFIX}`, id: crypto.randomUUID() },
    org_c: { name: `org_c_${RANDOM_SUFFIX}`, id: crypto.randomUUID() },
    org_d: { name: `org_d_${RANDOM_SUFFIX}`, id: crypto.randomUUID() },
    org_e: { name: `org_e_${RANDOM_SUFFIX}`, id: crypto.randomUUID() },
  };

  const orgIdToRef: Record<string, string> = Object.fromEntries(
    Object.keys(orgs).map((ref) => [orgs[ref].id, ref]),
  );
  const orgDatasets: Record<string, string[]> = {};

  // Create test user
  await adminSupabase.auth.admin.createUser({
    id: TEST_USER_ID,
    email: `resolver_test_${TEST_USER_ID}@test.com`,
    password: "password123",
    email_confirm: true,
  });

  // Create organizations
  const orgsResult = await adminSupabase
    .from("organizations")
    .insert(
      Object.values(orgs).map((org) => ({
        id: org.id,
        org_name: org.name,
        created_by: TEST_USER_ID,
      })),
    )
    .select()
    .throwOnError();

  // Create datasets: "user", "connection", and "ingestion" for every org
  const datasets = await adminSupabase
    .from("datasets")
    .insert(
      orgsResult.data!.flatMap((org) => {
        const datasetIds: string[] = [
          crypto.randomUUID(),
          crypto.randomUUID(),
          crypto.randomUUID(),
        ];
        const orgRef = orgIdToRef[org.id];
        orgDatasets[orgRef] = datasetIds;

        return [
          {
            id: datasetIds[0],
            org_id: org.id,
            name: "user",
            display_name: `User Dataset for ${org.org_name}`,
            created_by: TEST_USER_ID,
            dataset_type: "USER_MODEL" as const,
          },
          {
            id: datasetIds[1],
            org_id: org.id,
            name: "connection",
            display_name: `Connection Dataset for ${org.org_name}`,
            created_by: TEST_USER_ID,
            dataset_type: "DATA_CONNECTION" as const,
          },
          {
            id: datasetIds[2],
            org_id: org.id,
            name: "ingestion",
            display_name: `Ingestion Dataset for ${org.org_name}`,
            created_by: TEST_USER_ID,
            dataset_type: "DATA_INGESTION" as const,
          },
        ];
      }),
    )
    .select()
    .throwOnError();

  // Create models: "alpha", "bravo", "charlie" for every USER_MODEL dataset
  const models = await adminSupabase
    .from("model")
    .insert(
      datasets.data!.flatMap((dataset) => {
        if (dataset.dataset_type !== "USER_MODEL") {
          return [];
        }
        return [
          {
            dataset_id: dataset.id,
            org_id: dataset.org_id,
            name: "alpha",
          },
          {
            dataset_id: dataset.id,
            org_id: dataset.org_id,
            name: "bravo",
          },
          {
            dataset_id: dataset.id,
            org_id: dataset.org_id,
            name: "charlie",
          },
        ];
      }),
    )
    .select()
    .throwOnError();

  // Create model revisions
  const modelRevisions = await adminSupabase
    .from("model_revision")
    .insert(
      models.data!.map((model) => ({
        org_id: model.org_id,
        model_id: model.id,
        name: model.name,
        revision_number: 1,
        hash: crypto.randomUUID(),
        language: "sql",
        code: "SELECT 1;",
        cron: "@daily",
        schema: [],
        kind: "FULL" as const,
      })),
    )
    .select()
    .throwOnError();

  // Create model releases
  await adminSupabase
    .from("model_release")
    .insert(
      modelRevisions.data!.map((revision) => ({
        org_id: revision.org_id,
        model_id: revision.model_id,
        model_revision_id: revision.id,
      })),
    )
    .select()
    .throwOnError();

  // Create runs: 2 per model with different timestamps
  const modelRuns = await adminSupabase
    .from("run")
    .insert(
      models.data!.flatMap((model) => [
        {
          org_id: model.org_id,
          dataset_id: model.dataset_id,
          status: "completed" as const,
          started_at: "2025-01-01T00:00:00Z",
          completed_at: "2025-01-01T00:00:00Z",
        },
        {
          org_id: model.org_id,
          dataset_id: model.dataset_id,
          status: "completed" as const,
          started_at: "2025-01-02T00:00:00Z",
          completed_at: "2025-01-02T00:00:00Z",
        },
      ]),
    )
    .select()
    .throwOnError();

  // Create materializations
  await adminSupabase
    .from("materialization")
    .insert(
      models.data!.flatMap((model, index) => {
        const firstRun = modelRuns.data![index * 2];
        const secondRun = modelRuns.data![index * 2 + 1];

        return [
          {
            org_id: model.org_id,
            dataset_id: model.dataset_id,
            run_id: firstRun.id,
            table_id: `data_model_${model.id}`,
            warehouse_fqn: `org_${model.org_id}.dataset_${model.dataset_id}.model_${model.id}`,
            schema: [],
          },
          {
            org_id: model.org_id,
            dataset_id: model.dataset_id,
            run_id: secondRun.id,
            table_id: model.id,
            warehouse_fqn: `org_${model.org_id}.dataset_${model.dataset_id}.model_${model.id}`,
            schema: [],
          },
        ];
      }),
    )
    .throwOnError();

  // Create resource_permissions
  // org_b's "user" dataset ID is orgDatasets["org_b"][0]
  // org_c's "user" dataset ID is orgDatasets["org_c"][0]
  const permissionsResult = await adminSupabase
    .from("resource_permissions")
    .insert([
      // Active: org_a can access org_b's "user" dataset
      {
        org_id: orgs.org_a.id,
        dataset_id: orgDatasets["org_b"][0],
        permission_level: "read",
        revoked_at: null,
      },
      // Revoked: org_a had access to org_c's "user" dataset
      {
        org_id: orgs.org_a.id,
        dataset_id: orgDatasets["org_c"][0],
        permission_level: "read",
        revoked_at: "2025-01-01T00:00:00Z",
      },
    ])
    .select()
    .throwOnError();

  const permissionIds = permissionsResult.data!.map((p) => p.id);

  return {
    adminSupabase,
    testUserId: TEST_USER_ID,
    randomSuffix: RANDOM_SUFFIX,
    orgs,
    orgDatasets,
    permissionIds,
  };
}

export async function teardown(fixture: ResolverFixtureData): Promise<void> {
  const { adminSupabase, testUserId, orgs } = fixture;
  const orgIds = Object.values(orgs).map((o) => o.id);

  // Delete in reverse dependency order
  await adminSupabase
    .from("resource_permissions")
    .delete()
    .in("org_id", orgIds)
    .throwOnError();

  await adminSupabase
    .from("materialization")
    .delete()
    .in("org_id", orgIds)
    .throwOnError();

  await adminSupabase.from("run").delete().in("org_id", orgIds).throwOnError();

  await adminSupabase
    .from("model_release")
    .delete()
    .in("org_id", orgIds)
    .throwOnError();

  await adminSupabase
    .from("model_revision")
    .delete()
    .in("org_id", orgIds)
    .throwOnError();

  await adminSupabase
    .from("model")
    .delete()
    .in("org_id", orgIds)
    .throwOnError();

  await adminSupabase
    .from("datasets")
    .delete()
    .in("org_id", orgIds)
    .throwOnError();

  await adminSupabase
    .from("users_by_organization")
    .delete()
    .in("org_id", orgIds)
    .throwOnError();

  await adminSupabase
    .from("organizations")
    .delete()
    .in("id", orgIds)
    .throwOnError();

  await adminSupabase
    .from("user_profiles")
    .delete()
    .eq("id", testUserId)
    .throwOnError();

  await adminSupabase.auth.admin.deleteUser(testUserId);
}
