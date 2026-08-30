import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import {
  CREATOR_INVITE_EMAIL_MISMATCH_MESSAGE,
  CREATOR_INVITE_EXPIRED_MESSAGE,
  CREATOR_INVITE_INVALID_MESSAGE,
  CREATOR_INVITE_TTL_MS,
  CREATOR_WORKSPACE_ACCESS_LABEL,
  assertCreatorInviteAccountLinkable,
  classifyCreatorInviteFailure,
  creatorInviteAuditMetadataIsSafe,
  creatorInviteIsConsumable,
  creatorInvitePublicPath,
  emailsMatchForInvite,
  projectCreatorWorkspaceAccessStatus,
  type CreatorInviteFailureCode,
  type CreatorInviteRecordStatus,
  type CreatorInvitePreview,
  type CreatorWorkspaceAccessView,
} from "@/features/creator-workspace/onboarding";
import { validateCreatorInvitePassword } from "@/features/creator-workspace/password";
import { generateInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { buildCreatorWorkspaceInviteEmail } from "@/lib/email/creator-workspace-invite-email";
import { assertOutboundEmailReady, sendEmail } from "@/lib/email/provider";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import { emailSchema } from "@/lib/validation/schemas";

type Service = SupabaseClient;

type StoredCreatorInvite = {
  id: string;
  email: string;
  status: string;
  portal_type: string;
  influencer_id: string | null;
  expires_at: string;
  role_id: string | null;
};

function serviceDb(): Service | null {
  return tryCreateServiceRoleClient().client as Service | null;
}

export async function resolveCreatorInviteOrigin(): Promise<string> {
  try {
    const headerList = await headers();
    const origin = headerList.get("origin")?.replace(/\/$/, "");
    if (origin) return origin;
  } catch {
    // Server components may not always expose origin.
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://dev.thinkwaymedia.com"
  );
}

async function influencerRoleId(db: Service): Promise<string | null> {
  const { data } = await db.from("roles").select("id").eq("slug", "influencer").maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function loadInfluencer(
  db: Service,
  influencerId: string
): Promise<{ id: string; display_name: string; email: string | null; profile_id: string | null } | null> {
  const { data } = await db
    .from("influencers")
    .select("id, display_name, email, profile_id")
    .eq("id", influencerId)
    .maybeSingle();
  return data as {
    id: string;
    display_name: string;
    email: string | null;
    profile_id: string | null;
  } | null;
}

async function latestCreatorInvite(
  db: Service,
  influencerId: string
): Promise<StoredCreatorInvite | null> {
  const { data } = await (db as any)
    .from("user_invites")
    .select("id, email, status, portal_type, influencer_id, expires_at, role_id")
    .eq("influencer_id", influencerId)
    .eq("portal_type", "creator")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as StoredCreatorInvite | null) ?? null;
}

async function pendingCreatorInvite(
  db: Service,
  influencerId: string
): Promise<StoredCreatorInvite | null> {
  const { data } = await (db as any)
    .from("user_invites")
    .select("id, email, status, portal_type, influencer_id, expires_at, role_id")
    .eq("influencer_id", influencerId)
    .eq("portal_type", "creator")
    .eq("status", "invited")
    .maybeSingle();
  return (data as StoredCreatorInvite | null) ?? null;
}

async function inviteByTokenHash(
  db: Service,
  tokenHash: string
): Promise<StoredCreatorInvite | null> {
  const { data } = await (db as any)
    .from("user_invites")
    .select("id, email, status, portal_type, influencer_id, expires_at, role_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  return (data as StoredCreatorInvite | null) ?? null;
}

async function logCreatorInvite(
  db: Service,
  input: {
    actorId?: string | null;
    targetProfileId?: string | null;
    action: string;
    metadata: Record<string, unknown>;
  }
) {
  const metadata = { ...input.metadata };
  if (!creatorInviteAuditMetadataIsSafe(metadata)) {
    return;
  }
  await db.from("access_logs").insert({
    actor_id: input.actorId ?? null,
    target_profile_id: input.targetProfileId ?? null,
    action: input.action,
    module: "creator_workspace",
    metadata,
  } as never);
}

async function markExpiredIfNeeded(db: Service, invite: StoredCreatorInvite) {
  if (
    invite.status === "invited" &&
    !creatorInviteIsConsumable({
      status: invite.status,
      portalType: invite.portal_type,
      influencerId: invite.influencer_id,
      expiresAt: invite.expires_at,
    })
  ) {
    await (db as any)
      .from("user_invites")
      .update({ status: "expired" })
      .eq("id", invite.id)
      .eq("status", "invited");
    invite.status = "expired";
    await logCreatorInvite(db, {
      action: "creator_workspace_invite_expired",
      metadata: { influencer_id: invite.influencer_id },
    });
  }
}

export async function loadCreatorWorkspaceAccessView(
  influencerId: string
): Promise<CreatorWorkspaceAccessView | null> {
  const db = serviceDb();
  if (!db) return null;
  const influencer = await loadInfluencer(db, influencerId);
  if (!influencer) return null;
  const invite = await latestCreatorInvite(db, influencerId);
  if (invite) await markExpiredIfNeeded(db, invite);
  const status = projectCreatorWorkspaceAccessStatus({
    profileId: influencer.profile_id,
    inviteStatus: (invite?.status as CreatorInviteRecordStatus | undefined) ?? null,
    expiresAt: invite?.expires_at ?? null,
  });
  return {
    influencerId: influencer.id,
    displayName: influencer.display_name,
    email: influencer.email?.trim() || "",
    profileId: influencer.profile_id,
    status,
    statusLabel: CREATOR_WORKSPACE_ACCESS_LABEL[status],
    expiresAt: invite?.expires_at ?? null,
    invitedEmail: invite?.email ?? null,
    canInvite: status === "not_invited" || status === "revoked" || status === "expired",
    canResend: status === "invitation_pending",
    canRevokeInvitation: status === "invitation_pending",
    canRevokeAccess: status === "activated",
    canCopyLoginLink: status === "activated",
  };
}

function roleSlugFrom(role: unknown): string | null {
  if (Array.isArray(role)) {
    const first = role[0];
    if (first && typeof first === "object" && "slug" in first) {
      const slug = (first as { slug?: unknown }).slug;
      return typeof slug === "string" ? slug : null;
    }
    return null;
  }
  if (role && typeof role === "object" && "slug" in role) {
    const slug = (role as { slug?: unknown }).slug;
    return typeof slug === "string" ? slug : null;
  }
  return null;
}

async function profileByEmail(
  db: Service,
  email: string
): Promise<{ id: string; roleSlug: string | null } | null> {
  const { data } = await db
    .from("profiles")
    .select("id, role:roles(slug)")
    .ilike("email", email)
    .limit(2);
  const rows = (data ?? []) as unknown as Array<{ id: string; role: unknown }>;
  if (rows.length > 1) return { id: "ambiguous", roleSlug: null };
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, roleSlug: roleSlugFrom(row.role) };
}

async function waitForProfile(db: Service, userId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if ((data as { id?: string } | null)?.id) return true;
    await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
  }
  return false;
}

export async function previewCreatorInvite(
  rawToken: string
): Promise<
  | { ok: true; data: CreatorInvitePreview }
  | { ok: false; code: CreatorInviteFailureCode; message: string }
> {
  const token = rawToken.trim();
  if (!token) {
    return { ok: false, code: "invalid", message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  const db = serviceDb();
  if (!db) return { ok: false, code: "invalid", message: "Creator Workspace is temporarily unavailable." };
  let tokenHash: string;
  try {
    tokenHash = hashInviteToken(token);
  } catch {
    return { ok: false, code: "invalid", message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  const invite = await inviteByTokenHash(db, tokenHash);
  if (!invite) return { ok: false, code: "invalid", message: CREATOR_INVITE_INVALID_MESSAGE };
  await markExpiredIfNeeded(db, invite);
  const influencer = invite.influencer_id
    ? await loadInfluencer(db, invite.influencer_id)
    : null;
  const failure = classifyCreatorInviteFailure({
    found: true,
    status: invite.status,
    portalType: invite.portal_type,
    influencerId: invite.influencer_id,
    expiresAt: invite.expires_at,
    alreadyLinked: Boolean(influencer?.profile_id),
  });
  if (
    !creatorInviteIsConsumable({
      status: invite.status,
      portalType: invite.portal_type,
      influencerId: invite.influencer_id,
      expiresAt: invite.expires_at,
    })
  ) {
    return {
      ok: false,
      code: failure,
      message:
        failure === "expired" ? CREATOR_INVITE_EXPIRED_MESSAGE : CREATOR_INVITE_INVALID_MESSAGE,
    };
  }
  if (!influencer || influencer.profile_id) {
    return { ok: false, code: "invalid", message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  const existing = await profileByEmail(db, invite.email);
  if (existing?.id === "ambiguous") {
    return { ok: false, code: "invalid", message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  return {
    ok: true,
    data: {
      displayName: influencer.display_name,
      email: invite.email,
      mode: existing ? "accept" : "register",
    },
  };
}

async function sendInviteEmail(email: string, rawToken: string, origin: string) {
  const mailReady = assertOutboundEmailReady();
  if (!mailReady.ok) return mailReady;
  const activateUrl = `${origin}${creatorInvitePublicPath(rawToken)}`;
  const built = buildCreatorWorkspaceInviteEmail({ activateUrl });
  const sent = await sendEmail({
    to: [{ email }],
    subject: built.subject,
    html: built.html,
    text: built.plainText,
  });
  if (!sent.ok) return { ok: false as const, message: sent.error };
  return { ok: true as const };
}

export async function createOrRotateCreatorInvite(input: {
  actorId: string;
  influencerId: string;
  email: string;
  origin: string;
}): Promise<
  | { ok: true; activateUrl: string; emailSent: boolean; regenerated: boolean; emailError?: string }
  | { ok: false; message: string }
> {
  const parsedEmail = emailSchema.safeParse(input.email.trim().toLowerCase());
  if (!parsedEmail.success) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const db = serviceDb();
  if (!db) return { ok: false, message: "Creator Workspace is temporarily unavailable." };
  const influencer = await loadInfluencer(db, input.influencerId);
  if (!influencer) return { ok: false, message: "Creator profile was not found." };
  if (influencer.profile_id) {
    return { ok: false, message: "Creator Workspace is already activated for this profile." };
  }
  const roleId = await influencerRoleId(db);
  if (!roleId) return { ok: false, message: "Creator Workspace role is not configured." };

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + CREATOR_INVITE_TTL_MS).toISOString();
  const pending = await pendingCreatorInvite(db, input.influencerId);
  const activateUrl = `${input.origin}${creatorInvitePublicPath(rawToken)}`;

  if (pending) {
    const { error } = await (db as any)
      .from("user_invites")
      .update({
        email: parsedEmail.data,
        full_name: influencer.display_name,
        role_id: roleId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: input.actorId,
        status: "invited",
        metadata: { influencer_id: input.influencerId },
      })
      .eq("id", pending.id)
      .eq("status", "invited");
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await (db as any).from("user_invites").insert({
      email: parsedEmail.data,
      full_name: influencer.display_name,
      role_id: roleId,
      portal_type: "creator",
      influencer_id: input.influencerId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: input.actorId,
      status: "invited",
      metadata: { influencer_id: input.influencerId },
    });
    if (error) return { ok: false, message: error.message };
  }

  const sent = await sendInviteEmail(parsedEmail.data, rawToken, input.origin);
  await logCreatorInvite(db, {
    actorId: input.actorId,
    action: pending
      ? "creator_workspace_invite_regenerated"
      : "creator_workspace_invite_generated",
    metadata: {
      influencer_id: input.influencerId,
      email: parsedEmail.data,
      email_sent: sent.ok,
    },
  });

  if (!sent.ok) {
    return {
      ok: true,
      activateUrl,
      emailSent: false,
      regenerated: Boolean(pending),
      emailError: sent.message,
    };
  }

  return {
    ok: true,
    activateUrl,
    emailSent: true,
    regenerated: Boolean(pending),
  };
}

export async function revokeCreatorInvitation(input: {
  actorId: string;
  influencerId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = serviceDb();
  if (!db) return { ok: false, message: "Creator Workspace is temporarily unavailable." };
  const { error } = await (db as any)
    .from("user_invites")
    .update({
      status: "revoked",
      metadata: { influencer_id: input.influencerId, revoked_at: new Date().toISOString() },
    })
    .eq("influencer_id", input.influencerId)
    .eq("portal_type", "creator")
    .eq("status", "invited");
  if (error) return { ok: false, message: error.message };
  await logCreatorInvite(db, {
    actorId: input.actorId,
    action: "creator_workspace_invite_revoked",
    metadata: { influencer_id: input.influencerId },
  });
  return { ok: true };
}

export async function revokeCreatorWorkspaceAccess(input: {
  actorId: string;
  influencerId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = serviceDb();
  if (!db) return { ok: false, message: "Creator Workspace is temporarily unavailable." };
  const influencer = await loadInfluencer(db, input.influencerId);
  if (!influencer) return { ok: false, message: "Creator profile was not found." };
  if (influencer.profile_id) {
    const { error } = await db
      .from("influencers")
      .update({ profile_id: null } as never)
      .eq("id", input.influencerId)
      .eq("profile_id", influencer.profile_id);
    if (error) return { ok: false, message: error.message };

    const { data: profile } = await db
      .from("profiles")
      .select("id, role:roles(slug)")
      .eq("id", influencer.profile_id)
      .maybeSingle();
    const roleSlug = roleSlugFrom((profile as { role?: unknown } | null)?.role);
    if (roleSlug === "influencer") {
      const viewerId = await viewerRoleId(db);
      if (viewerId) {
        await db
          .from("profiles")
          .update({ role_id: viewerId } as never)
          .eq("id", influencer.profile_id);
      }
    }
  }

  await (db as any)
    .from("user_invites")
    .update({
      status: "revoked",
      metadata: {
        influencer_id: input.influencerId,
        access_revoked_at: new Date().toISOString(),
      },
    })
    .eq("influencer_id", input.influencerId)
    .eq("portal_type", "creator")
    .in("status", ["invited", "accepted"]);

  await logCreatorInvite(db, {
    actorId: input.actorId,
    targetProfileId: influencer.profile_id,
    action: "creator_workspace_access_revoked",
    metadata: { influencer_id: input.influencerId },
  });
  return { ok: true };
}

async function consumeInvite(db: Service, inviteId: string, userId: string): Promise<boolean> {
  const { data, error } = await (db as any)
    .from("user_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: userId,
    })
    .eq("id", inviteId)
    .eq("status", "invited")
    .select("id")
    .maybeSingle();
  return !error && Boolean(data?.id);
}

async function linkInfluencerProfile(
  db: Service,
  influencerId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("influencers")
    .update({ profile_id: userId } as never)
    .eq("id", influencerId)
    .is("profile_id", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data?.id) {
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  return { ok: true };
}

async function assignInfluencerRole(
  db: Service,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const roleId = await influencerRoleId(db);
  if (!roleId) return { ok: false, message: "Creator Workspace role is not configured." };
  const { data, error } = await db
    .from("profiles")
    .update({ role_id: roleId, is_active: true } as never)
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    return { ok: false, message: "Could not assign the Creator Workspace role." };
  }
  return { ok: true };
}

async function viewerRoleId(db: Service): Promise<string | null> {
  const { data } = await db.from("roles").select("id").eq("slug", "viewer").maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function accountGuards(
  db: Service,
  userId: string,
  invite: StoredCreatorInvite
): Promise<{ ok: true; email: string; roleSlug: string | null } | { ok: false; message: string }> {
  const { data: profile } = await db
    .from("profiles")
    .select("id, email, role:roles(slug)")
    .eq("id", userId)
    .maybeSingle();
  const row = profile as { id: string; email: string | null; role: unknown } | null;
  const { data: clientUser } = await db
    .from("client_users")
    .select("id")
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();
  const { data: linked } = await db
    .from("influencers")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  const check = assertCreatorInviteAccountLinkable({
    authenticatedEmail: row?.email,
    inviteEmail: invite.email,
    inviteInfluencerId: invite.influencer_id ?? "",
    roleSlug: roleSlugFrom(row?.role),
    hasClientUser: Boolean(clientUser?.id),
    linkedInfluencerId: (linked as { id: string } | null)?.id ?? null,
  });
  if (!check.ok) return { ok: false, message: check.message };
  return { ok: true, email: row?.email ?? invite.email, roleSlug: roleSlugFrom(row?.role) };
}

export async function registerCreatorFromInvite(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  const passwordCheck = validateCreatorInvitePassword({
    password: input.password,
    confirmPassword: input.confirmPassword,
  });
  if (!passwordCheck.ok) return passwordCheck;
  const db = serviceDb();
  if (!db) return { ok: false, message: "Creator Workspace is temporarily unavailable." };
  let tokenHash: string;
  try {
    tokenHash = hashInviteToken(input.token);
  } catch {
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  const invite = await inviteByTokenHash(db, tokenHash);
  if (
    !invite ||
    !creatorInviteIsConsumable({
      status: invite.status,
      portalType: invite.portal_type,
      influencerId: invite.influencer_id,
      expiresAt: invite.expires_at,
    })
  ) {
    if (invite) {
      await markExpiredIfNeeded(db, invite);
      await logCreatorInvite(db, {
        action: "creator_workspace_invite_failed",
        metadata: { influencer_id: invite.influencer_id, reason: "not_consumable" },
      });
    }
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }

  const existing = await profileByEmail(db, invite.email);
  if (existing?.id === "ambiguous") {
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  if (existing) {
    return { ok: false, message: "This email already has a Thinkway account. Sign in to accept the invitation." };
  }

  const influencer = await loadInfluencer(db, invite.influencer_id as string);
  if (!influencer || influencer.profile_id) {
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }

  const created = await db.auth.admin.createUser({
    email: invite.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: influencer.display_name },
  });
  if (created.error || !created.data.user?.id) {
    const message = created.error?.message ?? "Could not create the account.";
    if (/already|registered|exists/i.test(message)) {
      return {
        ok: false,
        message: "This email already has a Thinkway account. Sign in to accept the invitation.",
      };
    }
    return { ok: false, message };
  }
  const userId = created.data.user.id;

  const profileReady = await waitForProfile(db, userId);
  if (!profileReady) {
    await db.auth.admin.deleteUser(userId);
    return { ok: false, message: "Could not create the Creator Workspace profile." };
  }

  const linked = await linkInfluencerProfile(db, invite.influencer_id as string, userId);
  if (!linked.ok) {
    await db.auth.admin.deleteUser(userId);
    return linked;
  }
  const roleAssigned = await assignInfluencerRole(db, userId);
  if (!roleAssigned.ok) {
    await db.from("influencers").update({ profile_id: null } as never).eq("id", invite.influencer_id);
    await db.auth.admin.deleteUser(userId);
    return roleAssigned;
  }
  const consumed = await consumeInvite(db, invite.id, userId);
  if (!consumed) {
    await db.from("influencers").update({ profile_id: null } as never).eq("id", invite.influencer_id);
    await db.auth.admin.deleteUser(userId);
    await logCreatorInvite(db, {
      action: "creator_workspace_invite_failed",
      metadata: { influencer_id: invite.influencer_id, reason: "consume_failed" },
    });
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  await logCreatorInvite(db, {
    actorId: userId,
    targetProfileId: userId,
    action: "creator_workspace_invite_accepted",
    metadata: { influencer_id: invite.influencer_id },
  });
  return { ok: true, email: invite.email };
}

export async function acceptCreatorInviteForUser(input: {
  token: string;
  userId: string;
  authenticatedEmail: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = serviceDb();
  if (!db) return { ok: false, message: "Creator Workspace is temporarily unavailable." };
  let tokenHash: string;
  try {
    tokenHash = hashInviteToken(input.token);
  } catch {
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  const invite = await inviteByTokenHash(db, tokenHash);
  if (
    !invite ||
    !creatorInviteIsConsumable({
      status: invite.status,
      portalType: invite.portal_type,
      influencerId: invite.influencer_id,
      expiresAt: invite.expires_at,
    })
  ) {
    if (invite) {
      await markExpiredIfNeeded(db, invite);
      await logCreatorInvite(db, {
        actorId: input.userId,
        action: "creator_workspace_invite_failed",
        metadata: { influencer_id: invite.influencer_id, reason: "not_consumable" },
      });
    }
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  const guards = await accountGuards(db, input.userId, invite);
  if (!guards.ok) {
    await logCreatorInvite(db, {
      actorId: input.userId,
      action: "creator_workspace_invite_failed",
      metadata: { influencer_id: invite.influencer_id, reason: "not_linkable" },
    });
    return guards;
  }
  if (!emailsMatchForInvite(input.authenticatedEmail, invite.email)) {
    await logCreatorInvite(db, {
      actorId: input.userId,
      action: "creator_workspace_invite_failed",
      metadata: { influencer_id: invite.influencer_id, reason: "email_mismatch" },
    });
    return { ok: false, message: CREATOR_INVITE_EMAIL_MISMATCH_MESSAGE };
  }

  const linked = await linkInfluencerProfile(db, invite.influencer_id as string, input.userId);
  if (!linked.ok) return linked;
  const roleAssigned = await assignInfluencerRole(db, input.userId);
  if (!roleAssigned.ok) {
    await db
      .from("influencers")
      .update({ profile_id: null } as never)
      .eq("id", invite.influencer_id)
      .eq("profile_id", input.userId);
    return roleAssigned;
  }
  const consumed = await consumeInvite(db, invite.id, input.userId);
  if (!consumed) {
    await db
      .from("influencers")
      .update({ profile_id: null } as never)
      .eq("id", invite.influencer_id)
      .eq("profile_id", input.userId);
    await logCreatorInvite(db, {
      actorId: input.userId,
      action: "creator_workspace_invite_failed",
      metadata: { influencer_id: invite.influencer_id, reason: "consume_failed" },
    });
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  await logCreatorInvite(db, {
    actorId: input.userId,
    targetProfileId: input.userId,
    action: "creator_workspace_invite_accepted",
    metadata: { influencer_id: invite.influencer_id },
  });
  return { ok: true };
}
