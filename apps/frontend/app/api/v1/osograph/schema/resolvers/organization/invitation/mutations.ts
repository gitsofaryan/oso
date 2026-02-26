import { v4 as uuid4 } from "uuid";
import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withOrgScopedClient,
  withValidation,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  CreateInvitationInputSchema,
  RevokeInvitationInputSchema,
} from "@/app/api/v1/osograph/types/generated/validation";
import { sendInvitationEmail } from "@/lib/services/email";
import { logger } from "@/lib/logger";
import {
  InvitationErrors,
  ServerErrors,
} from "@/app/api/v1/osograph/utils/errors";
import {
  getOrganization,
  getUserProfile,
} from "@/app/api/v1/osograph/utils/auth";
import { checkMembershipExists } from "@/app/api/v1/osograph/utils/resolver-helpers";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";

type InvitationMutationResolvers = Pick<
  Required<MutationResolvers>,
  "createInvitation" | "revokeInvitation"
>;

export const invitationMutations =
  createResolversCollection<InvitationMutationResolvers>()
    .defineWithBuilder("createInvitation", (builder) =>
      builder
        .use(withValidation(CreateInvitationInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const userProfile = await getUserProfile(
            context.userId,
            context.client,
          );
          const org = await getOrganization(input.orgId, context.client);

          const normalizedEmail = input.email.toLowerCase().trim();

          if (context.user.role === "user" && context.user.email) {
            const authenticatedEmail = context.user.email.toLowerCase();
            if (authenticatedEmail === normalizedEmail) {
              throw InvitationErrors.cannotInviteSelf();
            }
          }

          const { data: existingUser } = await context.client
            .from("user_profiles")
            .select("id")
            .ilike("email", normalizedEmail)
            .single();

          if (existingUser) {
            const membershipExists = await checkMembershipExists(
              existingUser.id,
              org.id,
              context.client,
            );

            if (membershipExists) {
              throw InvitationErrors.alreadyExists();
            }
          }

          const { data: existingInvitation } = await context.client
            .from("invitations")
            .select("id, expires_at")
            .eq("org_id", org.id)
            .ilike("email", normalizedEmail)
            .is("accepted_at", null)
            .is("deleted_at", null)
            .gt("expires_at", new Date().toISOString())
            .single();

          if (existingInvitation) {
            throw InvitationErrors.alreadyExists();
          }

          const invitationId = uuid4();

          const { data: invitation, error } = await context.client
            .from("invitations")
            .insert({
              id: invitationId,
              email: normalizedEmail,
              org_id: org.id,
              org_name: org.org_name,
              invited_by: userProfile.id,
            })
            .select()
            .single();

          if (error) {
            logger.error("Database error:", error);
            throw ServerErrors.database(
              `Failed to create invitation: ${error.message}`,
            );
          }

          try {
            await sendInvitationEmail({
              to: normalizedEmail,
              orgName: org.org_name,
              inviteToken: invitationId,
              inviterName:
                userProfile.full_name || userProfile.email || "Someone",
            });
          } catch (emailError) {
            logger.error("Failed to send invitation email:", emailError);
            throw ServerErrors.externalService(
              `Failed to send invitation email: ${
                emailError instanceof Error
                  ? emailError.message
                  : "Unknown error"
              }`,
            );
          }

          return {
            invitation,
            message: `Invitation sent to ${normalizedEmail}`,
            success: true,
          };
        }),
    )
    .defineWithBuilder("revokeInvitation", (builder) =>
      builder
        .use(withValidation(RevokeInvitationInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const { data: invitation, error: invError } = await context.client
            .from("invitations")
            .select("*")
            .eq("id", input.invitationId)
            .eq("org_id", input.orgId)
            .single();

          if (invError || !invitation) {
            throw InvitationErrors.notFound();
          }

          const { error } = await context.client
            .from("invitations")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", input.invitationId);

          if (error) {
            throw ServerErrors.database(
              `Failed to revoke invitation: ${error.message}`,
            );
          }

          return {
            message: "Invitation revoked successfully",
            success: true,
          };
        }),
    )
    .resolvers();
