import {
  ServerErrors,
  ValidationErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { logger } from "@/lib/logger";
import { generateTableId } from "@/app/api/v1/osograph/utils/model";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withOrgResourceClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import { UpdateModelContextInputSchema } from "@/app/api/v1/osograph/types/generated/validation";

type ModelContextMutationResolvers = Pick<
  Required<MutationResolvers>,
  "updateModelContext"
>;

export const modelContextMutations =
  createResolversCollection<ModelContextMutationResolvers>()
    .defineWithBuilder("updateModelContext", (builder) =>
      builder
        .use(withValidation(UpdateModelContextInputSchema()))
        .use(
          withOrgResourceClient(
            "dataset",
            ({ args }) => args.input.datasetId,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const {
            datasetId,
            modelId,
            context: modelContext,
            columnContext,
          } = input;

          // Check access to dataset
          const { data: dataset, error: datasetError } = await context.client
            .from("datasets")
            .select("org_id, dataset_type")
            .eq("id", datasetId)
            .single();

          if (datasetError || !dataset) {
            throw ValidationErrors.invalidInput(
              "datasetId",
              "Dataset not found",
            );
          }

          const tableId = generateTableId(dataset.dataset_type, modelId);

          // Check if context exists
          const { data: existingContext } = await context.client
            .from("model_contexts")
            .select("id")
            .eq("dataset_id", datasetId)
            .eq("table_id", tableId)
            .is("deleted_at", null)
            .maybeSingle();

          let upsertedData;
          let upsertError;

          const payload = {
            org_id: dataset.org_id,
            dataset_id: datasetId,
            table_id: tableId,
            context: modelContext ?? null,
            column_context:
              columnContext?.map((col) => ({
                name: col.name,
                context: col.context ?? null,
              })) ?? null,
            updated_at: new Date().toISOString(),
          };

          if (existingContext) {
            const result = await context.client
              .from("model_contexts")
              .update(payload)
              .eq("id", existingContext.id)
              .select()
              .single();
            upsertedData = result.data;
            upsertError = result.error;
          } else {
            const result = await context.client
              .from("model_contexts")
              .insert(payload)
              .select()
              .single();
            upsertedData = result.data;
            upsertError = result.error;
          }

          if (upsertError || !upsertedData) {
            logger.error(
              `Failed to update model context: ${upsertError?.message}`,
            );
            throw ServerErrors.database("Failed to update model context");
          }

          return {
            success: true,
            message: "Model context updated successfully",
            modelContext: upsertedData,
          };
        }),
    )
    .resolvers();
