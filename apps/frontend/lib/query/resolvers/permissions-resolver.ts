import z from "zod";
import { TableResolver, TableResolutionMap } from "@/lib/query/resolver";
import { logger } from "@/lib/logger";
import { queryMetadataSchema } from "@/lib/types/query-metadata";
import { LegacyTableMappingRule } from "@/lib/query/common";
import { Table } from "@/lib/types/table";
import { PermissionError } from "@/lib/types/errors";
import { SupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * This resolver is responsible for ensuring that the user has access to any
 * tables in the query. It should be used _before_ the DBTableResolver so that
 * we can avoid making unnecessary database calls for tables that the user
 * doesn't have access to.
 *
 * If the user doesn't have access to a table, we throw a PermissionError. This
 * will be caught by the resolver pipeline and returned to the user as a 403
 * Forbidden error.
 *
 * For now, permissions are inferred _only_ from the orgName in the query
 * metadata. If the orgName in the metadata doesn't match the orgName parsed
 * from the table's catalog, we throw a PermissionError. Once we have created
 * the data marketplace and related permissioning system, we will need to update
 * this resolver.
 */
export class PermissionsResolver implements TableResolver {
  private client: SupabaseAdminClient;
  private legacyRules: LegacyTableMappingRule[];

  constructor(
    client: SupabaseAdminClient,
    legacyRules: LegacyTableMappingRule[],
  ) {
    this.client = client;
    this.legacyRules = legacyRules;
  }

  async resolveTables(
    tables: TableResolutionMap,
    metadata: Record<string, unknown>,
  ): Promise<TableResolutionMap> {
    // Check for the orgName in metadata to infer table mappings
    let parsedMetadata: z.infer<typeof queryMetadataSchema>;
    try {
      // If the metadata is invalid, we skip this resolver
      parsedMetadata = queryMetadataSchema.parse(metadata);
    } catch (e) {
      logger.info(
        `MetadataInferredTableResolver: Invalid metadata, skipping resolver: ${e}`,
      );
      return tables;
    }

    const { data: permissions } = await this.client
      .from("resource_permissions")
      .select(
        "*, organizations!inner(org_name), datasets!inner(name, organizations(org_name))",
      )
      .eq("organizations.org_name", parsedMetadata.orgName)
      .not("dataset_id", "is", null)
      .is("revoked_at", null);

    const permissionMap = new Map<string, Set<string>>();
    for (const permission of permissions ?? []) {
      const datasetName = permission.datasets.name;
      const orgName = permission.datasets.organizations.org_name;
      if (!permissionMap.has(orgName)) {
        permissionMap.set(orgName, new Set<string>());
      }
      permissionMap.get(orgName)?.add(datasetName);
    }

    const resolvedTables: TableResolutionMap = {};
    for (const [ref, table] of Object.entries(tables)) {
      // If there's a legacy rule that applies use it immediately as the response
      let resolvedTable: Table | null = null;
      for (const rule of this.legacyRules) {
        const result = rule(table);
        if (result) {
          resolvedTable = result;
          break;
        }
      }
      if (resolvedTable) {
        resolvedTables[ref] = resolvedTable;
        continue;
      }

      // If the table is not fully qualified, we can't check permissions on it,
      // We should error
      if (!table.isFQN()) {
        throw new PermissionError(
          `Table ${table.toString()} is not fully qualified, unable to check permissions`,
        );
      }

      const permission = permissionMap.get(table.catalog)?.has(table.dataset);

      if (table.catalog !== parsedMetadata.orgName && !permission) {
        throw new PermissionError(
          `Current user or organization does not have access to table ${table.toString()}`,
        );
      }
      resolvedTables[ref] = table;
    }
    return resolvedTables;
  }
}
