import { ServerErrors } from "@/app/api/v1/osograph/utils/errors";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withOrgResourceClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import { UpdateDatasetInputSchema } from "@/app/api/v1/osograph/types/generated/validation";

type DatasetMutationResolvers = Pick<
  Required<MutationResolvers>,
  "updateDataset" | "deleteDataset"
>;

export const datasetMutations =
  createResolversCollection<DatasetMutationResolvers>()
    .defineWithBuilder("updateDataset", (builder) =>
      builder
        .use(withValidation(UpdateDatasetInputSchema()))
        .use(
          withOrgResourceClient(
            "dataset",
            ({ args }) => args.input.id,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const { data, error } = await context.client
            .from("datasets")
            .update({
              name: input.name ?? undefined,
              display_name: input.displayName ?? undefined,
              description: input.description ?? undefined,
            })
            .eq("id", input.id)
            .select()
            .single();

          if (error) {
            throw ServerErrors.database(
              `Failed to update dataset: ${error.message}`,
            );
          }

          return {
            dataset: data,
            message: "Dataset updated successfully",
            success: true,
          };
        }),
    )
    .defineWithBuilder("deleteDataset", (builder) =>
      builder
        .use(withOrgResourceClient("dataset", ({ args }) => args.id, "admin"))
        .resolve(async (_, { id }, context) => {
          const { error } = await context.client
            .from("datasets")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

          if (error) {
            throw ServerErrors.database(
              `Failed to delete dataset: ${error.message}`,
            );
          }

          return {
            success: true,
            message: "Dataset deleted successfully",
          };
        }),
    )
    .resolvers();
