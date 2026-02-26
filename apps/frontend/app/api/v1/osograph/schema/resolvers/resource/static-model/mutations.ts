import { logger } from "@/lib/logger";
import {
  ResourceErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { putSignedUrl } from "@/lib/clients/cloudflare-r2";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { UpdateStaticModelInputSchema } from "@/app/api/v1/osograph/types/generated/validation";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withOrgResourceClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";

const FILES_BUCKET = "static-model-files";
const SIGNED_URL_EXPIRY = 900;

type StaticModelResourceMutationResolvers = Pick<
  Required<MutationResolvers>,
  "updateStaticModel" | "createStaticModelUploadUrl" | "deleteStaticModel"
>;

export const staticModelMutations =
  createResolversCollection<StaticModelResourceMutationResolvers>()
    .defineWithBuilder("updateStaticModel", (builder) =>
      builder
        .use(withValidation(UpdateStaticModelInputSchema()))
        .use(
          withOrgResourceClient(
            "static_model",
            ({ args }) => args.input.staticModelId,
            "write",
          ),
        )
        .resolve(async (_, { input }, context) => {
          const updateData: Record<string, string> = {};
          if (input.name !== undefined && input.name !== null) {
            updateData.name = input.name;
          }
          if (Object.keys(updateData).length > 0) {
            updateData.updated_at = new Date().toISOString();
          }

          const { data, error } = await context.client
            .from("static_model")
            .update(updateData)
            .eq("id", input.staticModelId)
            .select()
            .single();

          if (error) {
            logger.error("Failed to update staticModel:", error);
            throw ServerErrors.database("Failed to update staticModel");
          }

          return {
            success: true,
            message: "StaticModel updated successfully",
            staticModel: data,
          };
        }),
    )
    .defineWithBuilder("createStaticModelUploadUrl", (builder) =>
      builder
        .use(
          withOrgResourceClient(
            "static_model",
            ({ args }) => args.staticModelId,
            "write",
          ),
        )
        .resolve(async (_, { staticModelId }, context) => {
          const { data: staticModel, error: staticModelError } =
            await context.client
              .from("static_model")
              .select("org_id, dataset_id")
              .eq("id", staticModelId)
              .single();

          if (staticModelError || !staticModel) {
            throw ResourceErrors.notFound("StaticModel", staticModelId);
          }

          const presignedUrl = await putSignedUrl(
            FILES_BUCKET,
            `${staticModel.dataset_id}/${staticModelId}`,
            SIGNED_URL_EXPIRY,
          );

          return presignedUrl;
        }),
    )
    .defineWithBuilder("deleteStaticModel", (builder) =>
      builder
        .use(
          withOrgResourceClient("static_model", ({ args }) => args.id, "admin"),
        )
        .resolve(async (_, { id }, context) => {
          const { error } = await context.client
            .from("static_model")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", id);

          if (error) {
            throw ServerErrors.database(
              `Failed to delete static model: ${error.message}`,
            );
          }

          return {
            success: true,
            message: "StaticModel deleted successfully",
          };
        }),
    )
    .resolvers();
