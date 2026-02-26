import type { GraphQLFieldResolver, GraphQLScalarType } from "graphql";
import type {
  IsTypeOfResolverFn,
  TypeResolveFn,
} from "@/app/api/v1/osograph/types/generated/types";

// @apollo/subgraph's GraphQLResolverMap index signature doesn't accommodate
// __isTypeOf / __resolveType, which codegen adds to union-member resolver types.
// This local type widens the index signature to avoid false-positive TS errors.
export type SafeResolverMap<TContext> = {
  [typeName: string]:
    | GraphQLScalarType
    | { [enumValue: string]: string | number }
    | {
        [fieldName: string]:
          | GraphQLFieldResolver<never, TContext>
          | IsTypeOfResolverFn<never, TContext>
          | TypeResolveFn<string, never, TContext>
          | {
              requires?: string;
              resolve?: GraphQLFieldResolver<never, TContext>;
              subscribe?: GraphQLFieldResolver<never, TContext>;
            };
      };
};
