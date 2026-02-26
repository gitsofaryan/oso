import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { queryWithPagination } from "@/app/api/v1/osograph/utils/query-helpers";
import { RunWhereSchema } from "@/app/api/v1/osograph/utils/validation";

/**
 * Top-level runs query that fetches runs for the authenticated user's organizations.
 */
type RunsQueryResolvers = Pick<QueryResolvers, "runs">;
export const runsQueries: RunsQueryResolvers = {
  runs: createResolver<QueryResolvers, "runs">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      return queryWithPagination(args, context, {
        client: context.client,
        orgIds: context.orgIds,
        tableName: "run",
        whereSchema: RunWhereSchema,
      });
    }),
};
