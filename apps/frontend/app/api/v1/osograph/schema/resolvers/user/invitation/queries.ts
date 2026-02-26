import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { queryWithPagination } from "@/app/api/v1/osograph/utils/query-helpers";
import { InvitationWhereSchema } from "@/app/api/v1/osograph/utils/validation";

type InvitationQueryResolvers = Pick<QueryResolvers, "invitations">;
export const invitationQueries: InvitationQueryResolvers = {
  invitations: createResolver<QueryResolvers, "invitations">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      return queryWithPagination(args, context, {
        tableName: "invitations",
        whereSchema: InvitationWhereSchema,
        client: context.client,
        orgIds: context.orgIds,
      });
    }),
};
