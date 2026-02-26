import { v4 as uuidv4 } from "uuid";
import { ServerErrors } from "@/app/api/v1/osograph/utils/errors";
import { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withValidation,
  withOrgScopedClient,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import { CreateNotebookInputSchema } from "@/app/api/v1/osograph/types/generated/validation";

type NotebookMutationResolvers = Pick<
  Required<MutationResolvers>,
  "createNotebook"
>;

/**
 * Notebook mutations that operate at organization scope.
 * These resolvers use withOrgScopedClient because they don't have a resourceId yet.
 */
export const notebookMutations =
  createResolversCollection<NotebookMutationResolvers>()
    .defineWithBuilder("createNotebook", (builder) => {
      return builder
        .use(withValidation(CreateNotebookInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const notebookId = uuidv4();
          const { data: notebook, error } = await context.client
            .from("notebooks")
            .insert({
              id: notebookId,
              org_id: input.orgId,
              notebook_name: input.name,
              description: input.description,
              created_by: context.userId,
            })
            .select()
            .single();

          if (error) {
            throw ServerErrors.database(
              `Failed to create notebook: ${error.message}`,
            );
          }

          return {
            notebook,
            message: "Notebook created successfully",
            success: true,
          };
        });
    })
    .resolvers();
