import { logger } from "@/lib/logger";
import {
  ResourceErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { ModelUpdate } from "@/lib/types/schema-types";
import { createHash } from "crypto";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withOrgResourceClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  UpdateDataModelInputSchema,
  CreateDataModelRevisionInputSchema,
  CreateDataModelReleaseInputSchema,
} from "@/app/api/v1/osograph/types/generated/validation";

type DataModelMutationResolvers = Pick<
  Required<MutationResolvers>,
  | "updateDataModel"
  | "createDataModelRevision"
  | "createDataModelRelease"
  | "deleteDataModel"
>;

export const dataModelMutations =
  createResolversCollection<DataModelMutationResolvers>()
    .defineWithBuilder("updateDataModel", (builder) =>
      builder
        .use(withValidation(UpdateDataModelInputSchema()))
        .use(
          withOrgResourceClient(
            "data_model",
            ({ args }) => args.input.dataModelId,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const updateData: ModelUpdate = {};
          if (input.name != null) {
            updateData.name = input.name;
          }
          if (input.isEnabled != null) {
            updateData.is_enabled = input.isEnabled;
          }
          if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();
          }

          const { data, error } = await context.client
            .from("model")
            .update(updateData)
            .eq("id", input.dataModelId)
            .select()
            .single();

          if (error) {
            logger.error("Failed to update dataModel:", error);
            throw ServerErrors.database("Failed to update dataModel");
          }

          return {
            success: true,
            message: "DataModel updated successfully",
            dataModel: data,
          };
        }),
    )
    .defineWithBuilder("createDataModelRevision", (builder) =>
      builder
        .use(withValidation(CreateDataModelRevisionInputSchema()))
        .use(
          withOrgResourceClient(
            "data_model",
            ({ args }) => args.input.dataModelId,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const { data: dataModel, error: dataModelError } =
            await context.client
              .from("model")
              .select("org_id")
              .eq("id", input.dataModelId)
              .single();

          if (dataModelError || !dataModel) {
            throw ResourceErrors.notFound("DataModel", input.dataModelId);
          }

          const { data: latestRevision } = await context.client
            .from("model_revision")
            .select("*")
            .eq("model_id", input.dataModelId)
            .order("revision_number", { ascending: false })
            .limit(1)
            .single();

          const hash = createHash("sha256")
            .update(
              JSON.stringify(
                Object.entries(input).sort((a, b) => a[0].localeCompare(b[0])),
              ),
            )
            .digest("hex");

          if (latestRevision?.hash === hash) {
            return {
              success: true,
              message: "No changes detected, returning existing revision",
              dataModelRevision: latestRevision,
            };
          }

          const revisionNumber = (latestRevision?.revision_number || 0) + 1;

          const { data, error } = await context.client
            .from("model_revision")
            .insert({
              org_id: dataModel.org_id,
              model_id: input.dataModelId,
              name: input.name,
              description: input.description,
              revision_number: revisionNumber,
              hash,
              language: input.language,
              code: input.code,
              cron: input.cron,
              start: input.start ?? null,
              end: input.end ?? null,
              schema: input.schema.map((col) => ({
                name: col.name,
                type: col.type,
                description: col.description ?? null,
              })),
              depends_on: input.dependsOn?.map((d) => ({
                model_id: d.dataModelId,
                alias: d.alias ?? null,
              })),
              partitioned_by: input.partitionedBy,
              clustered_by: input.clusteredBy,
              kind: input.kind,
              kind_options: input.kindOptions
                ? {
                    time_column: input.kindOptions.timeColumn ?? null,
                    time_column_format:
                      input.kindOptions.timeColumnFormat ?? null,
                    batch_size: input.kindOptions.batchSize ?? null,
                    lookback: input.kindOptions.lookback ?? null,
                    unique_key_columns:
                      input.kindOptions.uniqueKeyColumns ?? null,
                    when_matched_sql: input.kindOptions.whenMatchedSql ?? null,
                    merge_filter: input.kindOptions.mergeFilter ?? null,
                    valid_from_name: input.kindOptions.validFromName ?? null,
                    valid_to_name: input.kindOptions.validToName ?? null,
                    invalidate_hard_deletes:
                      input.kindOptions.invalidateHardDeletes ?? null,
                    updated_at_column:
                      input.kindOptions.updatedAtColumn ?? null,
                    updated_at_as_valid_from:
                      input.kindOptions.updatedAtAsValidFrom ?? null,
                    scd_columns: input.kindOptions.scdColumns ?? null,
                    execution_time_as_valid_from:
                      input.kindOptions.executionTimeAsValidFrom ?? null,
                  }
                : null,
            })
            .select()
            .single();

          if (error) {
            logger.error("Failed to create dataModel revision:", error);
            throw ServerErrors.database("Failed to create dataModel revision");
          }

          return {
            success: true,
            message: "DataModel revision created successfully",
            dataModelRevision: data,
          };
        }),
    )
    .defineWithBuilder("createDataModelRelease", (builder) =>
      builder
        .use(withValidation(CreateDataModelReleaseInputSchema()))
        .use(
          withOrgResourceClient(
            "data_model",
            ({ args }) => args.input.dataModelId,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const { data: dataModel, error: dataModelError } =
            await context.client
              .from("model")
              .select("org_id")
              .eq("id", input.dataModelId)
              .single();

          if (dataModelError || !dataModel) {
            throw ResourceErrors.notFound("DataModel", input.dataModelId);
          }

          const { error: revisionError } = await context.client
            .from("model_revision")
            .select("id")
            .eq("id", input.dataModelRevisionId)
            .eq("model_id", input.dataModelId)
            .single();

          if (revisionError) {
            throw ResourceErrors.notFound(
              "DataModelRevision",
              input.dataModelRevisionId,
            );
          }

          const { data, error } = await context.client
            .from("model_release")
            .upsert({
              org_id: dataModel.org_id,
              model_id: input.dataModelId,
              model_revision_id: input.dataModelRevisionId,
              description: input.description,
            })
            .select()
            .single();

          if (error) {
            logger.error("Failed to create dataModel release:", error);
            throw ServerErrors.database("Failed to create dataModel release");
          }

          return {
            success: true,
            message: "DataModel release created successfully",
            dataModelRelease: data,
          };
        }),
    )
    .defineWithBuilder("deleteDataModel", (builder) =>
      builder
        .use(
          withOrgResourceClient("data_model", ({ args }) => args.id, "admin"),
        )
        .resolve(async (_, { id }, context) => {
          const { error } = await context.client
            .from("model")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

          if (error) {
            throw ServerErrors.database(
              `Failed to delete data model: ${error.message}`,
            );
          }

          return {
            success: true,
            message: "DataModel deleted successfully",
          };
        }),
    )
    .resolvers();
