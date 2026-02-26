import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type {
  Resolvers,
  UserResolvers,
} from "@/app/api/v1/osograph/types/generated/types";
import { getUserOrganizationsConnection } from "@/app/api/v1/osograph/utils/resolver-helpers";
import {
  validateInput,
  OrganizationWhereSchema,
} from "@/app/api/v1/osograph/utils/validation";
import { parseWhereClause } from "@/app/api/v1/osograph/utils/where-parser";
import { AuthenticationErrors } from "@/app/api/v1/osograph/utils/errors";

/**
 * Type resolvers for User.
 */
export const userTypeResolvers: Pick<Resolvers, "User"> = {
  User: {
    fullName: (parent) => parent.full_name,
    avatarUrl: (parent) => parent.avatar_url,
    email: (parent) => parent.email ?? "",
    organizations: createResolver<UserResolvers, "organizations">()
      .use(withAuthenticatedClient())
      .resolve(async (parent, args, context) => {
        if (parent.id !== context.userId) {
          throw AuthenticationErrors.notAuthorized();
        }

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
  },
};
