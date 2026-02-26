import { DateTimeISOResolver, GraphQLJSON } from "graphql-scalars";
import type { SafeResolverMap } from "@/app/api/v1/osograph/types/utils";
import type { GraphQLContext } from "@/app/api/v1/osograph/types/context";

import {
  queries as userQueries,
  mutations as userMutations,
  typeResolvers as userTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/user/index";
import {
  mutations as organizationMutations,
  typeResolvers as organizationTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/organization/index";
import {
  mutations as resourceMutations,
  typeResolvers as resourceTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/resource/index";
import {
  queries as systemQueries,
  mutations as systemMutations,
  typeResolvers as systemTypeResolvers,
} from "@/app/api/v1/osograph/schema/resolvers/system/index";

export const resolvers = {
  DateTime: DateTimeISOResolver,
  JSON: GraphQLJSON,

  Query: {
    ...userQueries,
    ...systemQueries,
  },

  Mutation: {
    ...userMutations,
    ...organizationMutations,
    ...resourceMutations,
    ...systemMutations,
  },

  ...userTypeResolvers,
  ...organizationTypeResolvers,
  ...resourceTypeResolvers,
  ...systemTypeResolvers,
} satisfies SafeResolverMap<GraphQLContext>;
