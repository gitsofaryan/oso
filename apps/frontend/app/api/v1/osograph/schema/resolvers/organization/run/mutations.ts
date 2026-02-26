import { logger } from "@/lib/logger";
import {
  ResourceErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withValidation,
  withOrgScopedClient,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  CreateDataIngestionRunRequestInputSchema,
  CreateStaticModelRunRequestInputSchema,
  CreateUserModelRunRequestInputSchema,
} from "@/app/api/v1/osograph/types/generated/validation";
import { getDatasetById } from "@/app/api/v1/osograph/utils/resolver-helpers";
import { createQueueService } from "@/lib/services/queue";
import { DataModelRunRequest } from "@opensource-observer/osoprotobufs/data-model";
import { DataIngestionRunRequest } from "@opensource-observer/osoprotobufs/data-ingestion";
import { StaticModelRunRequest } from "@opensource-observer/osoprotobufs/static-model";

type RunMutationResolvers = Pick<
  Required<MutationResolvers>,
  | "createUserModelRunRequest"
  | "createDataIngestionRunRequest"
  | "createStaticModelRunRequest"
>;

export const runMutations = createResolversCollection<RunMutationResolvers>()
  .defineWithBuilder("createUserModelRunRequest", (builder) =>
    builder
      .use(withValidation(CreateUserModelRunRequestInputSchema()))
      .use(
        withOrgScopedClient(async ({ args }) => {
          const dataset = await getDatasetById(args.input.datasetId);
          return dataset.org_id;
        }),
      )
      .resolve(async (_, { input }, context) => {
        const dataset = await getDatasetById(input.datasetId);

        const { data: run, error: runError } = await context.client
          .from("run")
          .insert({
            org_id: dataset.org_id,
            dataset_id: input.datasetId,
            run_type: "manual",
            requested_by: context.userId,
            models: input.selectedModels || [],
          })
          .select()
          .single();

        if (runError || !run) {
          logger.error(
            `Error creating run for dataset ${input.datasetId}: ${runError?.message}`,
          );
          throw ServerErrors.database("Failed to create run request");
        }

        const runIdBuffer = Buffer.from(run.id.replace(/-/g, ""), "hex");
        const queueService = createQueueService();
        const result = await queueService.queueMessage({
          queueName: "data_model_run_requests",
          message: {
            runId: new Uint8Array(runIdBuffer),
            datasetId: dataset.id,
            modelReleaseIds: input.selectedModels || [],
          },
          encoder: DataModelRunRequest,
        });

        if (!result.success) {
          logger.error(
            `Failed to publish message to queue: ${result.error?.message}`,
          );
          throw ServerErrors.queueError(
            result.error?.message || "Failed to publish to queue",
          );
        }

        logger.info(
          `Published data_model_run_requests message to queue. MessageId: ${result.messageId}`,
        );
        return {
          success: true,
          message: "Run request created successfully",
          run,
        };
      }),
  )
  .defineWithBuilder("createDataIngestionRunRequest", (builder) =>
    builder
      .use(withValidation(CreateDataIngestionRunRequestInputSchema()))
      .use(
        withOrgScopedClient(async ({ args }) => {
          const dataset = await getDatasetById(args.input.datasetId);
          return dataset.org_id;
        }),
      )
      .resolve(async (_, { input }, context) => {
        const dataset = await getDatasetById(input.datasetId);

        const { data: run, error: runError } = await context.client
          .from("run")
          .insert({
            org_id: dataset.org_id,
            dataset_id: input.datasetId,
            run_type: "manual",
            requested_by: context.userId,
            models: [],
          })
          .select()
          .single();

        if (runError || !run) {
          logger.error(
            `Error creating run for dataset ${input.datasetId}: ${runError?.message}`,
          );
          throw ServerErrors.database("Failed to create run request");
        }

        const { data: config, error: configError } = await context.client
          .from("data_ingestions")
          .select("*")
          .eq("dataset_id", input.datasetId)
          .is("deleted_at", null)
          .single();

        if (configError || !config) {
          logger.error(
            `Error fetching config for dataset ${input.datasetId}: ${configError?.message}`,
          );
          throw ResourceErrors.notFound("Config not found for dataset");
        }

        const runIdBuffer = Buffer.from(run.id.replace(/-/g, ""), "hex");
        const queueService = createQueueService();
        const result = await queueService.queueMessage({
          queueName: "data_ingestion_run_requests",
          message: {
            runId: new Uint8Array(runIdBuffer),
            datasetId: dataset.id,
          },
          encoder: DataIngestionRunRequest,
        });

        if (!result.success) {
          logger.error(
            `Failed to publish message to queue: ${result.error?.message}`,
          );
          throw ServerErrors.queueError(
            result.error?.message || "Failed to publish to queue",
          );
        }

        logger.info(
          `Published data_ingestion_run_requests message to queue. MessageId: ${result.messageId}`,
        );
        return {
          success: true,
          message: "Run request created successfully",
          run,
        };
      }),
  )
  .defineWithBuilder("createStaticModelRunRequest", (builder) =>
    builder
      .use(withValidation(CreateStaticModelRunRequestInputSchema()))
      .use(
        withOrgScopedClient(async ({ args }) => {
          const dataset = await getDatasetById(args.input.datasetId);
          return dataset.org_id;
        }),
      )
      .resolve(async (_, { input }, context) => {
        const dataset = await getDatasetById(input.datasetId);

        const { data: run, error: runError } = await context.client
          .from("run")
          .insert({
            org_id: dataset.org_id,
            dataset_id: input.datasetId,
            run_type: "manual",
            requested_by: context.userId,
            models: input.selectedModels || [],
          })
          .select()
          .single();

        if (runError || !run) {
          logger.error(
            `Error creating run for dataset ${input.datasetId}: ${runError?.message}`,
          );
          throw ServerErrors.database("Failed to create run request");
        }

        const runIdBuffer = Buffer.from(run.id.replace(/-/g, ""), "hex");
        const queueService = createQueueService();
        const result = await queueService.queueMessage({
          queueName: "static_model_run_requests",
          message: {
            runId: new Uint8Array(runIdBuffer),
            datasetId: dataset.id,
            modelIds: input.selectedModels || [],
          },
          encoder: StaticModelRunRequest,
        });

        if (!result.success) {
          logger.error(
            `Failed to publish message to queue: ${result.error?.message}`,
          );
          throw ServerErrors.queueError(
            result.error?.message || "Failed to publish to queue",
          );
        }

        logger.info(
          `Published static_model_run_requests message to queue. MessageId: ${result.messageId}`,
        );
        return {
          success: true,
          message: "Run request created successfully",
          run,
        };
      }),
  )
  .resolvers();
