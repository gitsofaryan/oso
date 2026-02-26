import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import {
  ExplicitClientQueryOptions,
  queryWithPagination,
} from "@/app/api/v1/osograph/utils/query-helpers";
import { StaticModelWhereSchema } from "@/app/api/v1/osograph/utils/validation";

type StaticModelQueryResolvers = Pick<QueryResolvers, "staticModels">;
export const staticModelQueries: StaticModelQueryResolvers = {
  staticModels: createResolver<QueryResolvers, "staticModels">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      const options: ExplicitClientQueryOptions<"static_model"> = {
        client: context.client,
        orgIds: context.orgIds,
        tableName: "static_model",
        whereSchema: StaticModelWhereSchema,
        basePredicate: {
          is: [{ key: "deleted_at", value: null }],
        },
      };

      return queryWithPagination(args, context, options);
    }),
};
