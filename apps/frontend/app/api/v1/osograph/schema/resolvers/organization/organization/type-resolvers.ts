import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withOrgScopedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import { getUserProfile } from "@/app/api/v1/osograph/utils/auth";
import {
  ExplicitClientQueryOptions,
  queryWithPagination,
} from "@/app/api/v1/osograph/utils/query-helpers";
import {
  NotebookWhereSchema,
  DatasetWhereSchema,
  DataConnectionWhereSchema,
} from "@/app/api/v1/osograph/utils/validation";
import { RESOURCE_CONFIG } from "@/app/api/v1/osograph/utils/access-control";
import {
  buildConnection,
  emptyConnection,
} from "@/app/api/v1/osograph/utils/connection";
import type {
  Resolvers,
  OrganizationResolvers,
  OrganizationMemberResolvers,
} from "@/app/api/v1/osograph/types/generated/types";
import { MemberRoleSchema } from "@/app/api/v1/osograph/types/generated/validation";
import { UserProfilesRow } from "@/lib/types/schema-types";

/**
 * Type resolvers for Organization and OrganizationMember.
 * Simple field mappers are plain functions; auth'd connection fields use createResolver + withOrgScopedClient.
 * Codegen mappers ensure OrganizationsRow / UsersByOrganizationRow are used as parent types.
 */
export const organizationTypeResolvers: Pick<
  Resolvers,
  "Organization" | "OrganizationMember"
> = {
  Organization: {
    name: (parent) => parent.org_name,
    displayName: (parent) => parent.org_name,
    createdAt: (parent) => parent.created_at,
    updatedAt: (parent) => parent.updated_at,

    members: createResolver<OrganizationResolvers, "members">()
      .use(withOrgScopedClient(({ parent }) => parent.id))
      .resolve(async (parent, args, context) => {
        let query = context.client
          .from("users_by_organization")
          .select("*, user_profiles(*)", { count: "exact" })
          .eq("org_id", parent.id)
          .is("deleted_at", null);

        if (args.first) {
          query = query.limit(args.first);
        }

        const { data: membersData, count } = await query;

        if (!membersData || membersData.length === 0) {
          return emptyConnection();
        }

        const users = membersData
          .map((m: any) => m.user_profiles)
          .filter((user): user is UserProfilesRow => user !== null);

        return buildConnection(users, args, count ?? 0);
      }),

    notebooks: createResolver<OrganizationResolvers, "notebooks">()
      .use(withOrgScopedClient(({ parent }) => parent.id))
      .resolve(async (parent, args, context) => {
        const options: ExplicitClientQueryOptions<"notebooks"> = {
          client: context.client,
          orgIds: [parent.id],
          tableName: "notebooks",
          whereSchema: NotebookWhereSchema,
          basePredicate: {
            is: [{ key: "deleted_at", value: null }],
          },
        };

        return queryWithPagination(args, context, options);
      }),

    datasets: createResolver<OrganizationResolvers, "datasets">()
      .use(withOrgScopedClient(({ parent }) => parent.id))
      .resolve(async (parent, args, context) => {
        const options: ExplicitClientQueryOptions<"datasets"> = {
          client: context.client,
          orgIds: [parent.id],
          tableName: "datasets",
          whereSchema: DatasetWhereSchema,
          basePredicate: {
            is: [
              { key: "deleted_at", value: null },
              { key: "permission.revoked_at", value: null },
            ],
            eq: [{ key: "permission.org_id", value: parent.id }],
          },
          resourceConfig: RESOURCE_CONFIG["dataset"],
        };

        return queryWithPagination(args, context, options);
      }),

    dataConnections: createResolver<OrganizationResolvers, "dataConnections">()
      .use(withOrgScopedClient(({ parent }) => parent.id))
      .resolve(async (parent, args, context) => {
        const options: ExplicitClientQueryOptions<"dynamic_connectors"> = {
          client: context.client,
          orgIds: [parent.id],
          tableName: "dynamic_connectors",
          whereSchema: DataConnectionWhereSchema,
          basePredicate: {
            is: [{ key: "deleted_at", value: null }],
          },
        };

        return queryWithPagination(args, context, options);
      }),
  },

  OrganizationMember: {
    userId: (parent) => parent.user_id,
    orgId: (parent) => parent.org_id,
    userRole: (parent) => MemberRoleSchema.parse(parent.user_role),
    createdAt: (parent) => parent.created_at,

    user: createResolver<OrganizationMemberResolvers, "user">()
      .use(withOrgScopedClient(({ parent }) => parent.org_id))
      .resolve(async (parent, _args, context) => {
        return getUserProfile(parent.user_id, context.client);
      }),
  },
};
