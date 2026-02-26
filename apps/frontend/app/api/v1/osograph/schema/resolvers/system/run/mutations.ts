import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withSystemClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  ResourceErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import {
  StartRunInputSchema,
  FinishRunInputSchema,
  UpdateRunMetadataInputSchema,
  UpdateMetadataInputSchema,
} from "@/app/api/v1/osograph/types/generated/validation";
import z from "zod";
import { Json } from "@/lib/types/supabase";

type RunMutationResolvers = Pick<
  Required<MutationResolvers>,
  "startRun" | "finishRun" | "updateRunMetadata"
>;

// Convert RunStatus enum from GraphQL to db run_status string
type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled";
const RunStatusMap: Record<string, RunStatus> = {
  QUEUED: "queued",
  RUNNING: "running",
  SUCCESS: "completed",
  FAILED: "failed",
  CANCELED: "canceled",
};

/**
 * Update the existing metadata with the provided update. The existing metadata
 * _must_ be a valid object or an error is thrown which will result in a 500.
 *
 * The update can either replace the existing metadata or merge with it based on
 * the `merge` flag in the update argument.
 *
 * @param existing - existing metadata object
 * @param update - optional update to apply
 *
 * @returns the updated metadata object
 */
function updateMetadata(
  existing: Json,
  update?: z.infer<ReturnType<typeof UpdateMetadataInputSchema>> | null,
): Record<string, any> {
  try {
    const parsedExisting = z.record(z.any()).parse(existing || {});
    if (!update) {
      return parsedExisting;
    }
    if (update.merge) {
      return { ...parsedExisting, ...update.value };
    } else {
      return update.value;
    }
  } catch (e) {
    throw ServerErrors.internal(
      `Existing metadata is not a valid object: ${e}`,
    );
  }
}

export const runMutations: RunMutationResolvers =
  createResolversCollection<RunMutationResolvers>()
    .defineWithBuilder("startRun", (builder) => {
      return builder
        .use(withValidation(StartRunInputSchema()))
        .use(withSystemClient())
        .resolve(async (_, { input }, context) => {
          const { runId } = input;

          const { data: runData, error: runError } = await context.client
            .from("run")
            .select("*")
            .eq("id", runId)
            .single();
          if (runError || !runData) {
            throw ResourceErrors.notFound(`Run ${runId} not found`);
          }
          // Update the status of the run to "RUNNING"
          const { data: updatedRun, error: updateError } = await context.client
            .from("run")
            .update({ status: "running", started_at: new Date().toISOString() })
            .eq("id", runId)
            .select()
            .single();
          if (updateError || !updatedRun) {
            throw ServerErrors.internal(
              `Failed to update run ${runId} status to running`,
            );
          }

          return {
            message: "Marked run as running",
            success: true,
            run: updatedRun,
          };
        });
    })
    .defineWithBuilder("finishRun", (builder) => {
      return builder
        .use(withValidation(FinishRunInputSchema()))
        .use(withSystemClient())
        .resolve(async (_, { input }, context) => {
          const { status, statusCode, runId, logsUrl, metadata } = input;

          const { data: runData, error: runError } = await context.client
            .from("run")
            .select("*")
            .eq("id", runId)
            .single();
          if (runError || !runData) {
            throw ResourceErrors.notFound(`Run ${runId} not found`);
          }

          const updatedMetadata = updateMetadata(runData.metadata, metadata);

          // Update the status and logsUrl of the run based on the input
          const { data: updatedRun, error: updateError } = await context.client
            .from("run")
            .update({
              status: RunStatusMap[status] || "failed",
              status_code: statusCode,
              logs_url: logsUrl,
              completed_at: new Date().toISOString(),
              metadata: updatedMetadata,
            })
            .eq("id", runId)
            .select()
            .single();
          if (updateError || !updatedRun) {
            throw ServerErrors.internal(
              `Failed to update run ${runId} status to ${status}`,
            );
          }

          return {
            message: "Committed run completion",
            success: true,
            run: updatedRun,
          };
        });
    })
    .defineWithBuilder("updateRunMetadata", (builder) => {
      return builder
        .use(withValidation(UpdateRunMetadataInputSchema()))
        .use(withSystemClient())
        .resolve(async (_, { input }, context) => {
          const { runId, metadata } = input;

          const { data: runData, error: runError } = await context.client
            .from("run")
            .select("*")
            .eq("id", runId)
            .single();
          if (runError || !runData) {
            throw ResourceErrors.notFound(`Run ${runId} not found`);
          }

          const updatedMetadata = updateMetadata(runData.metadata, metadata);

          // Update the metadata of the run
          const { data: updatedRun, error: updateError } = await context.client
            .from("run")
            .update({
              metadata: updatedMetadata,
            })
            .eq("id", runId)
            .select()
            .single();
          if (updateError || !updatedRun) {
            throw ServerErrors.internal(
              `Failed to update metadata for run ${runId}`,
            );
          }

          return {
            message: "Updated run metadata",
            success: true,
            run: updatedRun,
          };
        });
    })
    .resolvers();
