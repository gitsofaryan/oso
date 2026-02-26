import { createResolver } from "@/app/api/v1/osograph/utils/resolver-builder";
import { withOrgScopedClient } from "@/app/api/v1/osograph/utils/resolver-middleware";
import {
  getOrganization,
  getUserProfile,
} from "@/app/api/v1/osograph/utils/auth";
import type {
  InvitationResolvers,
  Resolvers,
} from "@/app/api/v1/osograph/types/generated/types";

/**
 * Type resolvers for Invitation.
 * These field resolvers don't require auth checks as they operate on
 * already-fetched invitation data.
 */
export const invitationTypeResolvers: Required<Pick<Resolvers, "Invitation">> =
  {
    Invitation: {
      orgId: (parent) => parent.org_id,

      status: (parent) => {
        if (parent.deleted_at) return "REVOKED";
        if (parent.accepted_at) return "ACCEPTED";
        if (new Date(parent.expires_at) < new Date()) return "EXPIRED";
        return "PENDING";
      },

      createdAt: (parent) => parent.created_at,
      expiresAt: (parent) => parent.expires_at,
      acceptedAt: (parent) => parent.accepted_at,
      deletedAt: (parent) => parent.deleted_at,

      organization: createResolver<InvitationResolvers, "organization">()
        .use(withOrgScopedClient(({ parent }) => parent.org_id))
        .resolve(async (parent, _, context) =>
          getOrganization(parent.org_id, context.client),
        ),

      invitedBy: createResolver<InvitationResolvers, "invitedBy">()
        .use(withOrgScopedClient(({ parent }) => parent.org_id))
        .resolve(async (parent, _, context) =>
          getUserProfile(parent.invited_by, context.client),
        ),

      acceptedBy: createResolver<InvitationResolvers, "acceptedBy">()
        .use(withOrgScopedClient(({ parent }) => parent.org_id))
        .resolve(async (parent, _, context) => {
          if (!parent.accepted_by) return null;
          return getUserProfile(parent.accepted_by, context.client);
        }),

      // TODO(jabolo): Add user_role column to invitations table and return actual role in invitation. (#6567)
      userRole: () => "admin",
    },
  };
