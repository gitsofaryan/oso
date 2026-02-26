import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import {
  queryWithPagination,
  type ExplicitClientQueryOptions,
} from "@/app/api/v1/osograph/utils/query-helpers";
import { DataConnectionWhereSchema } from "@/app/api/v1/osograph/utils/validation";

type DataConnectionQueryResolvers = Pick<QueryResolvers, "dataConnections">;
export const dataConnectionQueries: DataConnectionQueryResolvers = {
  dataConnections: createResolver<QueryResolvers, "dataConnections">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      // NOTE: There is no dataConnections table, we just changed the name,
      // that's why there's a name mismatch in the options
      const options: ExplicitClientQueryOptions<"dynamic_connectors"> = {
        client: context.client,
        orgIds: context.orgIds,
        tableName: "dynamic_connectors",
        whereSchema: DataConnectionWhereSchema,
        basePredicate: {
          is: [{ key: "deleted_at", value: null }],
        },
      };

      return queryWithPagination(args, context, options);
    }),
};
