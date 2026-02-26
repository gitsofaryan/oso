import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withSystemClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type {
  Resolvers,
  SystemResolvers,
} from "@/app/api/v1/osograph/types/generated/types";
import { Table } from "@/lib/types/table";
import { LegacyInferredTableResolver } from "@/lib/query/resolvers/legacy-table-resolver";
import { DBTableResolver } from "@/lib/query/resolvers/db-table-resolver";
import { TableResolutionMap } from "@/lib/query/resolver";
import {
  ResolveTablesSchema,
  validateInput,
} from "@/app/api/v1/osograph/utils/validation";
import { LegacyTableMappingRule } from "@/lib/query/common";
import { PermissionsResolver } from "@/lib/query/resolvers/permissions-resolver";

/**
 * Type resolvers for System.
 * These resolvers require system credentials and are used for internal operations.
 */
export const systemTypeResolvers: Pick<Resolvers, "System"> = {
  System: {
    resolveTables: createResolver<SystemResolvers, "resolveTables">()
      .use(withSystemClient())
      .resolve(async (_, args, context) => {
        const { references, metadata } = validateInput(
          ResolveTablesSchema,
          args,
        );

        const inferredTableResolver = new LegacyInferredTableResolver();

        const legacyMappingRules: LegacyTableMappingRule[] = [
          (table) => {
            // If the catalog is iceberg return the table as is
            if (table.catalog === "iceberg") {
              return table;
            }
            return null;
          },
          (table) => {
            // If the catalog has a double underscore in the name we assume it's a
            // legacy private connector catalog and return the table as is
            if (table.catalog.includes("__")) {
              return table;
            }
            return null;
          },
        ];

        const tableResolvers = [
          inferredTableResolver,
          new PermissionsResolver(context.client, legacyMappingRules),
          new DBTableResolver(context.client, legacyMappingRules),
        ];

        let tableResolutionMap: TableResolutionMap = {};
        for (const ref of references) {
          tableResolutionMap[ref] = Table.fromString(ref);
        }

        for (const resolver of tableResolvers) {
          tableResolutionMap = await resolver.resolveTables(
            tableResolutionMap,
            {
              orgName: metadata?.orgName,
              datasetName: metadata?.datasetName,
            },
          );
        }

        const results = Object.entries(tableResolutionMap).map(
          ([ref, table]) => ({
            reference: ref,
            fqn: table.toFQN(),
          }),
        );

        return results;
      }),
  },
};
