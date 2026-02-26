import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import {
  type ExplicitClientQueryOptions,
  queryWithPagination,
} from "@/app/api/v1/osograph/utils/query-helpers";
import { NotebookWhereSchema } from "@/app/api/v1/osograph/utils/validation";

type NotebookQueryResolvers = Pick<QueryResolvers, "notebooks">;
export const notebookQueries: NotebookQueryResolvers = {
  notebooks: createResolver<QueryResolvers, "notebooks">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      const options: ExplicitClientQueryOptions<"notebooks"> = {
        client: context.client,
        orgIds: context.orgIds,
        tableName: "notebooks",
        whereSchema: NotebookWhereSchema,
        basePredicate: {
          is: [{ key: "deleted_at", value: null }],
        },
      };

      return queryWithPagination(args, context, options);
    }),
};
