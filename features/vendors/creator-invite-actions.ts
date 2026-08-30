"use server";

import { revalidatePath } from "next/cache";

import {
  createOrRotateCreatorInvite,
  revokeCreatorInvitation,
  revokeCreatorWorkspaceAccess,
  resolveCreatorInviteOrigin,
} from "@/features/creator-workspace/onboarding-service";
import { requirePermission } from "@/lib/auth/permissions-server";
import { requireRequestUser } from "@/lib/supabase/server";

export type CreatorInviteActionState = {
  ok: boolean;
  message?: string;
};

async function requireInfluencerWrite() {
  const { supabase, userId } = await requireRequestUser();
  const auth = await requirePermission(supabase, "influencers.write");
  if ("error" in auth) {
    return { ok: false as const, message: auth.error, userId: null };
  }
  return { ok: true as const, userId, supabase };
}

function revalidateCreatorProfile(influencerId: string) {
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${influencerId}`);
}

export async function inviteCreatorToWorkspaceAction(
  _prev: CreatorInviteActionState,
  formData: FormData
): Promise<CreatorInviteActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!influencerId) return { ok: false, message: "Creator profile is required." };
  const auth = await requireInfluencerWrite();
  if (!auth.ok) return { ok: false, message: auth.message };
  const origin = await resolveCreatorInviteOrigin();
  const result = await createOrRotateCreatorInvite({
    actorId: auth.userId,
    influencerId,
    email,
    origin,
  });
  if (!result.ok) return result;
  revalidateCreatorProfile(influencerId);
  return { ok: true, message: "Invitation sent." };
}

export async function resendCreatorWorkspaceInviteAction(
  _prev: CreatorInviteActionState,
  formData: FormData
): Promise<CreatorInviteActionState> {
  return inviteCreatorToWorkspaceAction(_prev, formData);
}

export async function revokeCreatorWorkspaceInviteAction(
  _prev: CreatorInviteActionState,
  formData: FormData
): Promise<CreatorInviteActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) return { ok: false, message: "Creator profile is required." };
  const auth = await requireInfluencerWrite();
  if (!auth.ok) return { ok: false, message: auth.message };
  const result = await revokeCreatorInvitation({
    actorId: auth.userId,
    influencerId,
  });
  if (!result.ok) return result;
  revalidateCreatorProfile(influencerId);
  return { ok: true, message: "Invitation revoked." };
}

export async function revokeCreatorWorkspaceAccessAction(
  _prev: CreatorInviteActionState,
  formData: FormData
): Promise<CreatorInviteActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) return { ok: false, message: "Creator profile is required." };
  const auth = await requireInfluencerWrite();
  if (!auth.ok) return { ok: false, message: auth.message };
  const result = await revokeCreatorWorkspaceAccess({
    actorId: auth.userId,
    influencerId,
  });
  if (!result.ok) return result;
  revalidateCreatorProfile(influencerId);
  return { ok: true, message: "Creator Workspace access revoked." };
}
