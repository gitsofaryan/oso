import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withAuthenticatedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { UserErrors } from "@/app/api/v1/osograph/utils/errors";

type ViewerQueryResolvers = Pick<QueryResolvers, "viewer">;
export const viewerQueries: ViewerQueryResolvers = {
  viewer: createResolver<QueryResolvers, "viewer">()
    .use(withAuthenticatedClient())
    .resolve(async (_, _args, context) => {
      const { data: profile, error } = await context.client
        .from("user_profiles")
        .select("*")
        .eq("id", context.userId)
        .single();

      if (error || !profile) {
        throw UserErrors.profileNotFound();
      }

      return profile;
    }),
};
