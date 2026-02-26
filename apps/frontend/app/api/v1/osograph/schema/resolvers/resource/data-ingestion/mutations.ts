import {
  ResourceErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { logger } from "@/lib/logger";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withOrgResourceClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import { CreateDataIngestionInputSchema } from "@/app/api/v1/osograph/types/generated/validation";
import { toSupabaseJson } from "@/app/api/v1/osograph/utils/validation";

type DataIngestionMutationResolvers = Pick<
  Required<MutationResolvers>,
  "createDataIngestionConfig"
>;

export const dataIngestionMutations =
  createResolversCollection<DataIngestionMutationResolvers>()
    .defineWithBuilder("createDataIngestionConfig", (builder) =>
      builder
        .use(withValidation(CreateDataIngestionInputSchema()))
        .use(
          withOrgResourceClient(
            "dataset",
            ({ args }) => args.input.datasetId,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const { data: dataset, error: datasetError } = await context.client
            .from("datasets")
            .select("*")
            .eq("id", input.datasetId)
            .single();

          if (datasetError || !dataset) {
            logger.error(
              `Error fetching dataset with id ${input.datasetId}: ${datasetError?.message}`,
            );
            throw ResourceErrors.notFound("Dataset not found");
          }

          const { data: existingConfig } = await context.client
            .from("data_ingestions")
            .select("id")
            .eq("dataset_id", input.datasetId)
            .is("deleted_at", null)
            .maybeSingle();

          const { data: config, error: configError } = existingConfig
            ? await context.client
                .from("data_ingestions")
                .update({
                  factory_type: input.factoryType,
                  config: toSupabaseJson(input.config),
                })
                .eq("id", existingConfig.id)
                .select()
                .single()
            : await context.client
                .from("data_ingestions")
                .insert({
                  dataset_id: input.datasetId,
                  factory_type: input.factoryType,
                  config: toSupabaseJson(input.config),
                  org_id: dataset.org_id,
                  name: dataset.name,
                })
                .select()
                .single();

          if (configError || !config) {
            logger.error(
              `Error creating data ingestion config: ${configError?.message}`,
            );
            throw ServerErrors.database(
              "Failed to create data ingestion config",
            );
          }

          return config;
        }),
    )
    .resolvers();
