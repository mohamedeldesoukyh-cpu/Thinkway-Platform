import { INTERNAL_ROLE_SLUGS } from "@/features/settings/constants";

export const CREATOR_INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const CREATOR_INVITE_PASSWORD_MIN = 8;

export const CREATOR_INVITE_INVALID_MESSAGE =
  "This invitation is no longer valid.";

export const CREATOR_INVITE_CONFLICT_MESSAGE =
  "This account is already linked to another creator. Ask Thinkway to resolve it.";

export const CREATOR_INVITE_STAFF_MESSAGE =
  "This email belongs to a Thinkway staff or client login and cannot activate Creator Workspace.";

export const CREATOR_INVITE_EMAIL_MISMATCH_MESSAGE =
  "Sign in with the email this invitation was sent to.";

export const CREATOR_WORKSPACE_ACCESS_STATUSES = [
  "not_invited",
  "invitation_pending",
  "activated",
  "revoked",
  "expired",
] as const;

export type CreatorWorkspaceAccessStatus =
  (typeof CREATOR_WORKSPACE_ACCESS_STATUSES)[number];

export const CREATOR_WORKSPACE_ACCESS_LABEL: Record<
  CreatorWorkspaceAccessStatus,
  string
> = {
  not_invited: "Not invited",
  invitation_pending: "Invitation pending",
  activated: "Activated",
  revoked: "Revoked",
  expired: "Expired",
};

export type CreatorInviteRecordStatus =
  | "invited"
  | "accepted"
  | "revoked"
  | "expired";

export function creatorInviteHasExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return true;
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return true;
  return expires.getTime() <= now.getTime();
}

export function projectCreatorWorkspaceAccessStatus(input: {
  profileId: string | null | undefined;
  inviteStatus: CreatorInviteRecordStatus | null;
  expiresAt: string | null;
  now?: Date;
}): CreatorWorkspaceAccessStatus {
  if (input.profileId) return "activated";
  if (!input.inviteStatus) return "not_invited";
  if (input.inviteStatus === "accepted") return "not_invited";
  if (input.inviteStatus === "revoked") return "revoked";
  if (
    input.inviteStatus === "expired" ||
    creatorInviteHasExpired(input.expiresAt, input.now)
  ) {
    return "expired";
  }
  return "invitation_pending";
}

export function creatorInviteIsConsumable(input: {
  status: string | null | undefined;
  portalType: string | null | undefined;
  influencerId: string | null | undefined;
  expiresAt: string | null | undefined;
  now?: Date;
}): boolean {
  return (
    input.status === "invited" &&
    input.portalType === "creator" &&
    Boolean(input.influencerId) &&
    !creatorInviteHasExpired(input.expiresAt, input.now)
  );
}

export function emailsMatchForInvite(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = left?.trim().toLowerCase() ?? "";
  const b = right?.trim().toLowerCase() ?? "";
  return a.length > 0 && a === b;
}

export type CreatorInviteLinkCheck =
  | { ok: true }
  | {
      ok: false;
      code: "email_mismatch" | "staff_or_client" | "other_creator" | "invalid";
      message: string;
    };

export function assertCreatorInviteAccountLinkable(input: {
  authenticatedEmail: string | null | undefined;
  inviteEmail: string;
  inviteInfluencerId: string;
  roleSlug: string | null | undefined;
  hasClientUser: boolean;
  linkedInfluencerId: string | null | undefined;
}): CreatorInviteLinkCheck {
  if (!emailsMatchForInvite(input.authenticatedEmail, input.inviteEmail)) {
    return {
      ok: false,
      code: "email_mismatch",
      message: CREATOR_INVITE_EMAIL_MISMATCH_MESSAGE,
    };
  }
  const role = input.roleSlug?.trim() ?? "";
  const allowedCreatorRole = role === "" || role === "viewer" || role === "influencer";
  if (
    input.hasClientUser ||
    INTERNAL_ROLE_SLUGS.has(role) ||
    role === "client_user" ||
    !allowedCreatorRole
  ) {
    return {
      ok: false,
      code: "staff_or_client",
      message: CREATOR_INVITE_STAFF_MESSAGE,
    };
  }
  if (
    input.linkedInfluencerId &&
    input.linkedInfluencerId !== input.inviteInfluencerId
  ) {
    return {
      ok: false,
      code: "other_creator",
      message: CREATOR_INVITE_CONFLICT_MESSAGE,
    };
  }
  if (!input.inviteInfluencerId) {
    return {
      ok: false,
      code: "invalid",
      message: CREATOR_INVITE_INVALID_MESSAGE,
    };
  }
  return { ok: true };
}

export function creatorInvitePublicPath(rawToken: string): string {
  return `/creator-invite?token=${encodeURIComponent(rawToken.trim())}`;
}

export type CreatorInvitePreview = {
  displayName: string;
  email: string;
  mode: "register" | "accept";
};

export type CreatorWorkspaceAccessView = {
  influencerId: string;
  displayName: string;
  email: string;
  profileId: string | null;
  status: CreatorWorkspaceAccessStatus;
  statusLabel: string;
  expiresAt: string | null;
  invitedEmail: string | null;
  canInvite: boolean;
  canResend: boolean;
  canRevokeInvitation: boolean;
  canRevokeAccess: boolean;
};
