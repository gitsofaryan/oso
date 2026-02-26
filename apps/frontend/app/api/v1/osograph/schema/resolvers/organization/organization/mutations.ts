import { createResolversCollection } from "@/app/api/v1/osograph/utils/resolver-builder";
import {
  withValidation,
  withOrgScopedClient,
} from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  AddUserByEmailInputSchema,
  RemoveMemberInputSchema,
  UpdateMemberRoleInputSchema,
} from "@/app/api/v1/osograph/types/generated/validation";
import {
  UserErrors,
  OrganizationErrors,
  ServerErrors,
  createError,
  ErrorCode,
} from "@/app/api/v1/osograph/utils/errors";
import type { MutationResolvers } from "@/app/api/v1/osograph/types/generated/types";

type OrgMemberMutationResolvers = Pick<
  Required<MutationResolvers>,
  "addUserByEmail" | "removeMember" | "updateMemberRole"
>;

export const organizationMemberMutations =
  createResolversCollection<OrgMemberMutationResolvers>()
    .defineWithBuilder("addUserByEmail", (builder) =>
      builder
        .use(withValidation(AddUserByEmailInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const normalizedEmail = input.email.toLowerCase().trim();

          const { data: userProfile } = await context.client
            .from("user_profiles")
            .select("id")
            .ilike("email", normalizedEmail)
            .single();

          if (!userProfile) {
            throw UserErrors.notFound();
          }

          const { data: existingMember } = await context.client
            .from("users_by_organization")
            .select("id")
            .eq("user_id", userProfile.id)
            .eq("org_id", input.orgId)
            .is("deleted_at", null)
            .single();

          if (existingMember) {
            throw createError(
              ErrorCode.CONFLICT,
              "User is already a member of this organization",
            );
          }

          const { data: member, error } = await context.client
            .from("users_by_organization")
            .insert({
              org_id: input.orgId,
              user_id: userProfile.id,
              user_role: input.role.toLowerCase(),
            })
            .select()
            .single();

          if (error) {
            throw ServerErrors.database(
              `Failed to add user to organization: ${error.message}`,
            );
          }

          return {
            member,
            message: "User added to organization successfully",
            success: true,
          };
        }),
    )
    .defineWithBuilder("removeMember", (builder) =>
      builder
        .use(withValidation(RemoveMemberInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          if (input.userId === context.userId) {
            throw OrganizationErrors.cannotRemoveSelf();
          }

          const { error } = await context.client
            .from("users_by_organization")
            .update({ deleted_at: new Date().toISOString() })
            .eq("user_id", input.userId)
            .eq("org_id", input.orgId)
            .is("deleted_at", null);

          if (error) {
            throw ServerErrors.database(
              `Failed to remove member from organization: ${error.message}`,
            );
          }

          return {
            message: "Member removed successfully",
            success: true,
          };
        }),
    )
    .defineWithBuilder("updateMemberRole", (builder) =>
      builder
        .use(withValidation(UpdateMemberRoleInputSchema()))
        .use(withOrgScopedClient(({ args }) => args.input.orgId))
        .resolve(async (_, { input }, context) => {
          const { data: member, error } = await context.client
            .from("users_by_organization")
            .update({ user_role: input.role.toLowerCase() })
            .eq("user_id", input.userId)
            .eq("org_id", input.orgId)
            .is("deleted_at", null)
            .select()
            .single();

          if (error) {
            throw ServerErrors.database(
              `Failed to update member role: ${error.message}`,
            );
          }

          return {
            member,
            message: "Member role updated successfully",
            success: true,
          };
        }),
    )
    .resolvers();
