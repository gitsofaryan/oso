import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import {
  ExplicitClientQueryOptions,
  queryWithPagination,
} from "@/app/api/v1/osograph/utils/query-helpers";
import { DataModelWhereSchema } from "@/app/api/v1/osograph/utils/validation";

type DataModelQueryResolvers = Pick<QueryResolvers, "dataModels">;
export const dataModelQueries: DataModelQueryResolvers = {
  dataModels: createResolver<QueryResolvers, "dataModels">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      const options: ExplicitClientQueryOptions<"model"> = {
        client: context.client,
        orgIds: context.orgIds,
        tableName: "model",
        whereSchema: DataModelWhereSchema,
        basePredicate: {
          is: [{ key: "deleted_at", value: null }],
        },
      };

      return queryWithPagination(args, context, options);
    }),
};
