import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withSystemClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  ResourceErrors,
  ServerErrors,
  ValidationErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { logger } from "@/lib/logger";
import { validateTableId } from "@/app/api/v1/osograph/utils/model";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { CreateMaterializationInputSchema } from "@/app/api/v1/osograph/types/generated/validation";

type MaterializationMutationResolvers = Pick<
  Required<MutationResolvers>,
  "createMaterialization"
>;

export const materializationMutations: MaterializationMutationResolvers =
  createResolversCollection<MaterializationMutationResolvers>()
    .defineWithBuilder("createMaterialization", (builder) => {
      return builder
        .use(withValidation(CreateMaterializationInputSchema()))
        .use(withSystemClient())
        .resolve(async (_, { input }, context) => {
          const { stepId, tableId, schema, warehouseFqn } = input;

          // Assert that the tableId has one of the appropriate prefixes
          validateTableId(tableId);

          logger.info(`Creating materialization for step ${stepId}`);

          // Get the step
          const { data: stepData, error: stepError } = await context.client
            .from("step")
            .select("*")
            .eq("id", stepId)
            .single();
          if (stepError || !stepData) {
            logger.error(`Step ${stepId} not found: ${stepError?.message}`);
            throw ResourceErrors.notFound(`Step ${stepId} not found`);
          }

          // Get the dataset id from the run associated with the step
          const { data: runData, error: runError } = await context.client
            .from("run")
            .select("id, org_id, dataset_id")
            .eq("id", stepData.run_id)
            .single();
          if (runError || !runData) {
            logger.error(
              `Run for step ${stepId} not found: ${runError?.message}`,
            );
            throw ResourceErrors.notFound(`Run for step ${stepId} not found`);
          }

          if (runData.dataset_id === null) {
            logger.error(`Dataset ID for run ${runData.id} is null`);
            throw ValidationErrors.invalidInput(
              "stepId",
              `Associated run ${runData.id} does not have a dataset_id. ` +
                "Can only create materializations for dataset runs.",
            );
          }

          // Convert schema object to supported format (remove undefined)
          const dbSafeSchema = schema.map((entry) => {
            return {
              name: entry.name,
              type: entry.type,
              description: entry.description || null,
            };
          });

          // Create the materialization
          const { data: materializationData, error: materializationError } =
            await context.client
              .from("materialization")
              .insert({
                run_id: runData.id,
                org_id: runData.org_id,
                dataset_id: runData.dataset_id,
                step_id: stepId,
                schema: dbSafeSchema,
                created_at: new Date().toISOString(),
                table_id: tableId,
                warehouse_fqn: warehouseFqn,
              })
              .select()
              .single();
          if (materializationError || !materializationData) {
            throw ServerErrors.internal(
              `Failed to create materialization for step ${stepId}`,
            );
          }

          return {
            message: "Created materialization",
            success: true,
            materialization: materializationData,
          };
        });
    })
    .resolvers();
