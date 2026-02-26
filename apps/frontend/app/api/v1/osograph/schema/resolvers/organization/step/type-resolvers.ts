import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withOrgScopedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  StepStatus,
  type Resolvers,
  type StepResolvers,
} from "@/app/api/v1/osograph/types/generated/types";
import { logger } from "@/lib/logger";
import { ServerErrors } from "@/app/api/v1/osograph/utils/errors";
import { assertNever } from "@opensource-observer/utils";
import { getSignedUrl, parseGcsUrl } from "@/lib/clients/gcs";
import { queryWithPagination } from "@/app/api/v1/osograph/utils/query-helpers";
import { MaterializationWhereSchema } from "@/app/api/v1/osograph/utils/validation";
import type { StepRow } from "@/lib/types/schema-types";

function mapStepStatus(status: StepRow["status"]): StepStatus {
  switch (status) {
    case "running":
      return StepStatus.Running;
    case "failed":
      return StepStatus.Failed;
    case "canceled":
      return StepStatus.Canceled;
    case "success":
      return StepStatus.Success;
    default:
      assertNever(status, `Unknown step status: ${status}`);
  }
}

export const stepTypeResolvers: Required<Pick<Resolvers, "Step">> = {
  Step: {
    runId: (parent) => parent.run_id,
    name: (parent) => parent.name,
    displayName: (parent) => parent.display_name,
    startedAt: (parent) => parent.started_at,
    finishedAt: (parent) => parent.completed_at,
    status: (parent) => mapStepStatus(parent.status),

    logsUrl: async (parent) => {
      if (!parent.logs_url) return null;
      try {
        const parsed = parseGcsUrl(parent.logs_url);
        if (!parsed) {
          logger.warn(
            `Invalid GCS URL format for step ${parent.id}: ${parent.logs_url}`,
          );
          return parent.logs_url;
        }
        return await getSignedUrl(parsed.bucketName, parsed.fileName, 5);
      } catch (error) {
        logger.error(
          `Failed to generate signed URL for step ${parent.id}: ${error}`,
        );
        return parent.logs_url;
      }
    },

    run: createResolver<StepResolvers, "run">()
      .use(withOrgScopedClient(({ parent }) => parent.org_id))
      .resolve(async (parent, _args, context) => {
        const { data, error } = await context.client
          .from("run")
          .select("*")
          .eq("id", parent.run_id)
          .single();
        if (error) {
          logger.error(
            `Error fetching run with id ${parent.run_id}: ${error.message}`,
          );
          throw ServerErrors.database(
            `Failed to fetch run with id ${parent.run_id}`,
          );
        }
        return data;
      }),

    materializations: createResolver<StepResolvers, "materializations">()
      .use(withOrgScopedClient(({ parent }) => parent.org_id))
      .resolve(async (parent, args, context) => {
        return queryWithPagination(args, context, {
          client: context.client,
          orgIds: parent.org_id,
          tableName: "materialization",
          whereSchema: MaterializationWhereSchema,
          basePredicate: {
            eq: [{ key: "step_id", value: parent.id }],
          },
        });
      }),
  },
};
