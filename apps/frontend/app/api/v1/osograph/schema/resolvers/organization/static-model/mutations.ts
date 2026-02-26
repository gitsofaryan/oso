import { logger } from "@/lib/logger";
import { ServerErrors } from "@/app/api/v1/osograph/utils/errors";
import { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withValidation,
  withOrgScopedClient,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import { CreateStaticModelInputSchema } from "@/app/api/v1/osograph/types/generated/validation";

type StaticModelMutationResolvers = Pick<
  Required<MutationResolvers>,
  "createStaticModel"
>;

/**
 * Static model mutations that operate at organization scope.
 * These resolvers use withOrgScopedClient because they don't have a resourceId yet.
 */
export const staticModelMutations =
  createResolversCollection<StaticModelMutationResolvers>()
    .defineWithBuilder("createStaticModel", (builder) => {
      return builder
        .use(withValidation(CreateStaticModelInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const { data, error } = await context.client
            .from("static_model")
            .insert({
              org_id: input.orgId,
              dataset_id: input.datasetId,
              name: input.name,
            })
            .select()
            .single();

          if (error) {
            logger.error("Failed to create staticModel:", error);
            throw ServerErrors.database("Failed to create staticModel");
          }

          return {
            success: true,
            message: "StaticModel created successfully",
            staticModel: data,
          };
        });
    })
    .resolvers();
