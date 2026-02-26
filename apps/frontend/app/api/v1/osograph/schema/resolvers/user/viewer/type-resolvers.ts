import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type {
  Resolvers,
  ViewerResolvers,
} from "@/app/api/v1/osograph/types/generated/types";
import {
  getUserOrganizationsConnection,
  getUserInvitationsConnection,
} from "@/app/api/v1/osograph/utils/resolver-helpers";
import {
  ExplicitClientQueryOptions,
  queryWithPagination,
} from "@/app/api/v1/osograph/utils/query-helpers";
import {
  OrganizationWhereSchema,
  NotebookWhereSchema,
  DatasetWhereSchema,
  InvitationWhereSchema,
  validateInput,
} from "@/app/api/v1/osograph/utils/validation";
import { parseWhereClause } from "@/app/api/v1/osograph/utils/where-parser";

/**
 * Type resolvers for Viewer.
 */
export const viewerTypeResolvers: Pick<Resolvers, "Viewer"> = {
  Viewer: {
    fullName: (parent) => parent.full_name,
    avatarUrl: (parent) => parent.avatar_url,
    email: (parent) => parent.email ?? "",

    organizations: createResolver<ViewerResolvers, "organizations">()
      .use(withAuthenticatedClient())
      .resolve(async (parent, args, context) => {
        const validatedWhere = args.where
          ? validateInput(OrganizationWhereSchema, args.where)
          : undefined;

        return getUserOrganizationsConnection(
          parent.id,
          args,
          validatedWhere ? parseWhereClause(validatedWhere) : {},
          context.client,
          context.orgIds,
        );
      }),

    notebooks: createResolver<ViewerResolvers, "notebooks">()
      .use(withAuthenticatedClient())
      .resolve(async (_parent, args, context) => {
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

    datasets: createResolver<ViewerResolvers, "datasets">()
      .use(withAuthenticatedClient())
      .resolve(async (_parent, args, context) => {
        const options: ExplicitClientQueryOptions<"datasets"> = {
          client: context.client,
          orgIds: context.orgIds,
          tableName: "datasets",
          whereSchema: DatasetWhereSchema,
          basePredicate: {
            is: [{ key: "deleted_at", value: null }],
          },
        };

        return queryWithPagination(args, context, options);
      }),

    invitations: createResolver<ViewerResolvers, "invitations">()
      .use(withAuthenticatedClient())
      .resolve(async (parent, args, context) => {
        const validatedWhere = args.where
          ? validateInput(InvitationWhereSchema, args.where)
          : undefined;

        return getUserInvitationsConnection(
          parent.email,
          args,
          validatedWhere ? parseWhereClause(validatedWhere) : {},
          context.client,
        );
      }),
  },
};
