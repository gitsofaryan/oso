import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withSystemClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import type { QueryResolvers } from "@/app/api/v1/osograph/types/generated/types";

type SystemQueryResolvers = Pick<QueryResolvers, "system">;

export const systemQueries: SystemQueryResolvers = {
  system: createResolver<QueryResolvers, "system">()
    .use(withSystemClient())
    .resolve(async () => ({ resolveTables: [] })),
};
