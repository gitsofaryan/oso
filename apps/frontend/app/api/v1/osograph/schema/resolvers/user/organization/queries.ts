import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { getUserOrganizationsConnection } from "@/app/api/v1/osograph/utils/resolver-helpers";
import {
  OrganizationWhereSchema,
  validateInput,
} from "@/app/api/v1/osograph/utils/validation";
import { parseWhereClause } from "@/app/api/v1/osograph/utils/where-parser";

type OrganizationQueryResolvers = Pick<QueryResolvers, "organizations">;
export const organizationQueries: OrganizationQueryResolvers = {
  organizations: createResolver<QueryResolvers, "organizations">()
    .use(withAuthenticatedClient())
    .resolve(async (_, args, context) => {
      const validatedWhere = args.where
        ? validateInput(OrganizationWhereSchema, args.where)
        : undefined;

      const predicate = validatedWhere
        ? parseWhereClause(validatedWhere)
        : undefined;

      return getUserOrganizationsConnection(
        context.userId,
        args,
        predicate,
        context.client,
        context.orgIds,
      );
    }),
};
