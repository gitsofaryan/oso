import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withOrgScopedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import { logger } from "@/lib/logger";
import { ServerErrors } from "@/app/api/v1/osograph/utils/errors";
import type {
  MaterializationResolvers,
  Resolvers,
} from "@/app/api/v1/osograph/types/generated/types";

export const materializationTypeResolvers: Required<
  Pick<Resolvers, "Materialization">
> = {
  Materialization: {
    runId: (parent) => parent.run_id,
    stepId: (parent) => parent.step_id,
    run: createResolver<MaterializationResolvers, "run">()
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
    datasetId: (parent) => parent.dataset_id,
    createdAt: (parent) => parent.created_at,
    schema: (parent) =>
      parent.schema.filter(
        (col): col is typeof col & { name: string; type: string } =>
          col.name !== null && col.type !== null,
      ),

    step: createResolver<MaterializationResolvers, "step">()
      .use(withOrgScopedClient(({ parent }) => parent.org_id))
      .resolve(async (parent, _args, context) => {
        const stepId = parent.step_id;
        if (!stepId) return null;
        const { data, error } = await context.client
          .from("step")
          .select("*")
          .eq("id", stepId)
          .single();
        if (error) {
          logger.error(
            `Error fetching step with id ${stepId}: ${error.message}`,
          );
          throw ServerErrors.database(`Failed to fetch step with id ${stepId}`);
        }
        return data;
      }),
  },
};
