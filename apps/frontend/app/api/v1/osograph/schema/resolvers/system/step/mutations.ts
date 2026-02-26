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
  StartStepInputSchema,
  FinishStepInputSchema,
} from "@/app/api/v1/osograph/types/generated/validation";

type StepMutationResolvers = Pick<
  Required<MutationResolvers>,
  "startStep" | "finishStep"
>;

type StepStatus = "running" | "success" | "failed" | "canceled";
const StepStatusMap: Record<string, StepStatus> = {
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELED: "canceled",
};

export const stepMutations: StepMutationResolvers =
  createResolversCollection<StepMutationResolvers>()
    .defineWithBuilder("startStep", (builder) => {
      return builder
        .use(withValidation(StartStepInputSchema()))
        .use(withSystemClient())
        .resolve(async (_, { input }, context) => {
          const { runId, name, displayName } = input;

          // Get the run to ensure it exists
          const { data: runData, error: runError } = await context.client
            .from("run")
            .select("org_id")
            .eq("id", runId)
            .single();
          if (runError || !runData) {
            throw ResourceErrors.notFound(`Run ${runId} not found`);
          }

          // We start a new step for the given run
          const { data: stepData, error: stepError } = await context.client
            .from("step")
            .insert({
              run_id: runId,
              name,
              org_id: runData.org_id,
              display_name: displayName,
              status: "running",
              started_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (stepError || !stepData) {
            throw ServerErrors.internal(
              `Failed to start step ${name} for run ${runId}`,
            );
          }

          return { message: "Started step", success: true, step: stepData };
        });
    })
    .defineWithBuilder("finishStep", (builder) => {
      return builder
        .use(withValidation(FinishStepInputSchema()))
        .use(withSystemClient())
        .resolve(async (_, { input }, context) => {
          const { stepId, logsUrl, status } = input;

          const { data: stepData, error: stepError } = await context.client
            .from("step")
            .select("*")
            .eq("id", stepId)
            .single();
          if (stepError || !stepData) {
            throw ResourceErrors.notFound(`Step ${stepId} not found`);
          }

          // Update the status and logsUrl of the step based on the input
          const { data: updatedStep, error: updateError } = await context.client
            .from("step")
            .update({
              status: StepStatusMap[status] || "failed",
              logs_url: logsUrl,
              completed_at: new Date().toISOString(),
            })
            .eq("id", stepId)
            .select()
            .single();
          if (updateError || !updatedStep) {
            throw ServerErrors.internal(
              `Failed to update step ${stepId} status to ${status}`,
            );
          }

          return {
            message: "Committed step completion",
            success: true,
            step: updatedStep,
          };
        });
    })
    .resolvers();
