import {
  getOrganization,
  getUserProfile,
} from "@/app/api/v1/osograph/utils/auth";
import { getPreviewSignedUrl } from "@/lib/clients/cloudflare-r2";
import { logger } from "@/lib/logger";
import type {
  NotebookResolvers,
  Resolvers,
} from "@/app/api/v1/osograph/types/generated/types";
import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withOrgResourceClient } from "@/app/api/v1/osograph/utils/resolver-middleware";

const PREVIEWS_BUCKET = "notebook-previews";
const SIGNED_URL_EXPIRY = 900;

export const notebookTypeResolvers: Pick<Resolvers, "Notebook"> = {
  Notebook: {
    name: (parent) => parent.notebook_name,
    createdAt: (parent) => parent.created_at,
    updatedAt: (parent) => parent.updated_at,
    creatorId: (parent) => parent.created_by,
    orgId: (parent) => parent.org_id,

    creator: createResolver<NotebookResolvers, "creator">()
      .use(withOrgResourceClient("notebook", ({ parent }) => parent.id))
      .resolve(async (parent, _args, context) =>
        getUserProfile(parent.created_by, context.client),
      ),

    organization: createResolver<NotebookResolvers, "organization">()
      .use(withOrgResourceClient("notebook", ({ parent }) => parent.id))
      .resolve(async (parent, _args, context) =>
        getOrganization(parent.org_id, context.client),
      ),

    preview: async (parent) => {
      try {
        const objectKey = `${parent.id}.png`;
        const signedUrl = await getPreviewSignedUrl(
          PREVIEWS_BUCKET,
          objectKey,
          SIGNED_URL_EXPIRY,
        );

        return signedUrl;
      } catch (error) {
        logger.error(
          `Failed to generate preview URL for notebook ${parent.id}: ${error}`,
        );
        return null;
      }
    },
  },
};
