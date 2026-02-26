import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withSystemClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  ResourceErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import { generatePublishedNotebookPath } from "@/lib/notebook/utils";
import { revalidateTag } from "next/cache";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { SavePublishedNotebookHtmlInputSchema } from "@/app/api/v1/osograph/types/generated/validation";

type NotebookMutationResolvers = Pick<
  Required<MutationResolvers>,
  "savePublishedNotebookHtml"
>;

export const notebookMutations: NotebookMutationResolvers =
  createResolversCollection<NotebookMutationResolvers>()
    .defineWithBuilder("savePublishedNotebookHtml", (builder) => {
      return builder
        .use(withValidation(SavePublishedNotebookHtmlInputSchema()))
        .use(withSystemClient())
        .resolve(async (_, { input }, context) => {
          const { notebookId, htmlContent } = input;

          // Decode base64 content
          const byteArray = Buffer.from(htmlContent, "base64");

          const { data: notebook } = await context.client
            .from("notebooks")
            .select("org_id")
            .eq("id", notebookId)
            .single();
          if (!notebook) {
            throw ResourceErrors.notFound(`Notebook ${notebookId} not found`);
          }

          const filePath = generatePublishedNotebookPath(
            notebookId,
            notebook.org_id,
          );
          // Save the HTML content to Supabase Storage
          const { data: uploadData, error: uploadError } =
            await context.client.storage
              .from("published-notebooks")
              .upload(filePath, byteArray, {
                upsert: true,
                contentType: "text/html",
                headers: {
                  "Content-Encoding": "gzip",
                },
                // 5 Minute CDN cache. We will also cache on Vercel side to control it with revalidateTag
                cacheControl: "300",
              });
          if (uploadError || !uploadData) {
            throw ServerErrors.internal(
              `Failed to upload published notebook HTML for notebook ${notebookId}: ${uploadError.message}`,
            );
          }

          // Update the published_notebooks table with the new data path
          const { data: publishedNotebook, error: upsertError } =
            await context.client
              .from("published_notebooks")
              .upsert(
                {
                  notebook_id: notebookId,
                  data_path: filePath,
                  updated_at: new Date().toISOString(),
                  deleted_at: null,
                },
                { onConflict: "notebook_id" },
              )
              .select("id")
              .single();

          if (upsertError || !publishedNotebook) {
            throw ServerErrors.internal(
              `Failed to update published_notebooks for notebook ${notebookId}: ${upsertError.message}`,
            );
          }

          revalidateTag(publishedNotebook.id);

          return {
            message: "Saved published notebook HTML",
            success: true,
          };
        });
    })
    .resolvers();
