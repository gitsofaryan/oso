import { SupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import {
  OrganizationErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { getTrinoAdminClient } from "@/lib/clients/trino";
import { createTrinoCatalog } from "@/lib/dynamic-connectors";
import { DynamicConnectorsRow } from "@/lib/types/schema-types";
import {
  toSupabaseJson,
  CreateDataConnectionSchema,
  validateInput,
} from "@/app/api/v1/osograph/utils/validation";
import { createQueueService } from "@/lib/services/queue";
import { SyncConnectionRunRequest } from "@opensource-observer/osoprotobufs/sync-connection";
import { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withValidation,
  withOrgScopedClient,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import { CreateDataConnectionInputSchema } from "@/app/api/v1/osograph/types/generated/validation";

type DataConnectionMutationResolvers = Pick<
  Required<MutationResolvers>,
  "createDataConnection"
>;

async function syncDataConnection(
  client: SupabaseAdminClient,
  userId: string,
  dataConnection: Pick<DynamicConnectorsRow, "id" | "org_id">,
) {
  const { data: queuedRun, error: queuedRunError } = await client
    .from("run")
    .insert({
      org_id: dataConnection.org_id,
      run_type: "manual",
      requested_by: userId,
      metadata: {
        dataConnectionId: dataConnection.id,
      },
    })
    .select()
    .single();
  if (queuedRunError || !queuedRun) {
    logger.error(
      `Error creating run for data connection ${dataConnection.id}: ${queuedRunError?.message}`,
    );
    throw ServerErrors.database("Failed to create run request");
  }

  const queueService = createQueueService();

  const runIdBuffer = Buffer.from(queuedRun.id.replace(/-/g, ""), "hex");
  const publishMessage: SyncConnectionRunRequest = {
    runId: new Uint8Array(runIdBuffer),
    connectionId: dataConnection.id,
  };

  const result = await queueService.queueMessage({
    queueName: "sync_connection_run_requests",
    message: publishMessage,
    encoder: SyncConnectionRunRequest,
  });
  if (!result.success) {
    logger.error(
      `Failed to publish message to queue: ${result.error?.message}`,
    );
    throw ServerErrors.queueError(
      result.error?.message || "Failed to publish to queue",
    );
  }
  return queuedRun;
}

/**
 * Data connection mutations that operate at organization scope.
 * These resolvers use withOrgScopedClient because they don't have a resourceId yet.
 */
export const dataConnectionMutations =
  createResolversCollection<DataConnectionMutationResolvers>()
    .defineWithBuilder("createDataConnection", (builder) => {
      return builder
        .use(withValidation(CreateDataConnectionInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const { orgId, name, type, config, credentials } = validateInput(
            CreateDataConnectionSchema,
            input,
          );

          const { data: org, error: orgError } = await context.client
            .from("organizations")
            .select()
            .eq("id", orgId)
            .single();
          if (orgError || !org) {
            throw OrganizationErrors.notFound();
          }

          const { data, error } = await context.client
            .from("dynamic_connectors")
            .insert({
              org_id: orgId,
              connector_name: name,
              connector_type: type,
              config: toSupabaseJson(config),
              created_by: context.userId,
            })
            .select()
            .single();

          if (error) {
            logger.error("Failed to create data connection:", error);
            throw ServerErrors.database("Failed to create data connection");
          }

          const trinoClient = getTrinoAdminClient();
          const { error: trinoError } = await createTrinoCatalog(
            trinoClient,
            data,
            credentials,
          );
          if (trinoError) {
            // Best effort try to cleanup the connector from supabase
            await context.client
              .from("dynamic_connectors")
              .delete()
              .eq("id", data.id);
            throw ServerErrors.externalService(
              `Error creating catalog: ${trinoError}`,
            );
          }

          await syncDataConnection(context.client, context.userId, data);

          return {
            success: true,
            message: "Data connection created successfully",
            dataConnection: data,
          };
        });
    })
    .resolvers();
