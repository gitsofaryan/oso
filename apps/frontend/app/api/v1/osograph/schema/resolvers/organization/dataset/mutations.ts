import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";
import {
  ResourceErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { getResourcePublicPermission } from "@/app/api/v1/osograph/utils/access-control";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withValidation,
  withOrgScopedClient,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  CreateDatasetInputSchema,
  SubscribeToDatasetInputSchema,
  UnsubscribeFromDatasetInputSchema,
} from "@/app/api/v1/osograph/types/generated/validation";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";

type DatasetMutationResolvers = Pick<
  Required<MutationResolvers>,
  "createDataset" | "subscribeToDataset" | "unsubscribeFromDataset"
>;

/**
 * Dataset mutations that operate at organization scope.
 * These resolvers use withOrgScopedClient because they don't have a resourceId yet.
 */
export const datasetMutations =
  createResolversCollection<DatasetMutationResolvers>()
    .defineWithBuilder("createDataset", (builder) =>
      builder
        .use(withValidation(CreateDatasetInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const datasetId = uuidv4();

          const { data: dataset, error } = await context.client
            .from("datasets")
            .insert({
              id: datasetId,
              org_id: input.orgId,
              name: input.name,
              display_name: input.displayName,
              description: input.description ?? null,
              created_by: context.userId,
              dataset_type: input.type,
            })
            .select()
            .single();

          if (error) {
            logger.error("Failed to create dataset:", error);
            throw ServerErrors.database("Failed to create dataset");
          }

          return {
            dataset,
            message: "Dataset created successfully",
            success: true,
          };
        }),
    )
    .defineWithBuilder("subscribeToDataset", (builder) =>
      builder
        .use(withValidation(SubscribeToDatasetInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const publicPermission = await getResourcePublicPermission(
            input.datasetId,
            "dataset",
            context.client,
          );

          if (publicPermission === "none") {
            throw ResourceErrors.notFound("Dataset", input.datasetId);
          }

          const { error } = await context.client
            .from("resource_permissions")
            .insert({
              dataset_id: input.datasetId,
              org_id: input.orgId,
              permission_level: "read",
              granted_by: context.userId,
            });

          if (error?.code === "23505") {
            return { success: true, message: "Already subscribed" };
          }
          if (error) {
            logger.error("Failed to subscribe to dataset:", error);
            throw ServerErrors.database("Failed to subscribe to dataset");
          }

          return { success: true, message: "Subscribed successfully" };
        }),
    )
    .defineWithBuilder("unsubscribeFromDataset", (builder) =>
      builder
        .use(withValidation(UnsubscribeFromDatasetInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const { error } = await context.client
            .from("resource_permissions")
            .update({ revoked_at: new Date().toISOString() })
            .eq("dataset_id", input.datasetId)
            .eq("org_id", input.orgId)
            .is("user_id", null)
            .is("revoked_at", null);

          if (error) {
            logger.error("Failed to unsubscribe from dataset:", error);
            throw ServerErrors.database("Failed to unsubscribe from dataset");
          }

          return { success: true, message: "Unsubscribed successfully" };
        }),
    )
    .resolvers();
