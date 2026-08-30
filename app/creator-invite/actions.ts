"use server";

import { redirect } from "next/navigation";

import { CREATOR_INVITE_INVALID_MESSAGE } from "@/features/creator-workspace/onboarding";
import { validateCreatorInvitePassword } from "@/features/creator-workspace/password";
import {
  acceptCreatorInviteForUser,
  previewCreatorInvite,
  registerCreatorFromInvite,
  resolveCreatorInviteOrigin,
} from "@/features/creator-workspace/onboarding-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreatorInviteFormState = {
  ok: boolean;
  message?: string;
};

export async function registerFromCreatorInviteAction(
  _prev: CreatorInviteFormState,
  formData: FormData
): Promise<CreatorInviteFormState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const result = await registerCreatorFromInvite({
    token,
    password,
    confirmPassword,
  });
  if (!result.ok) return { ok: false, message: result.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.email,
    password,
  });
  if (error) {
    return {
      ok: false,
      message: "Your account was created. Sign in from the login page to open Creator Workspace.",
    };
  }
  redirect("/creator-portal");
}

export async function acceptCreatorInviteAction(
  _prev: CreatorInviteFormState,
  formData: FormData
): Promise<CreatorInviteFormState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const preview = await previewCreatorInvite(token);
  if (!preview.ok) return { ok: false, message: preview.message };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: preview.data.email,
    password,
  });
  if (error || !data.user?.id) {
    return { ok: false, message: "Check your password and try again." };
  }

  const accepted = await acceptCreatorInviteForUser({
    token,
    userId: data.user.id,
    authenticatedEmail: data.user.email,
  });
  if (!accepted.ok) {
    await supabase.auth.signOut();
    return { ok: false, message: accepted.message };
  }
  redirect("/creator-portal");
}

export async function requestCreatorInvitePasswordResetAction(
  _prev: CreatorInviteFormState,
  formData: FormData
): Promise<CreatorInviteFormState> {
  const token = String(formData.get("token") ?? "").trim();
  const preview = await previewCreatorInvite(token);
  if (!preview.ok) return { ok: false, message: preview.message };
  const origin = await resolveCreatorInviteOrigin();
  const supabase = await createSupabaseServerClient();
  const next = `/creator-invite?token=${encodeURIComponent(token)}`;
  const { error } = await supabase.auth.resetPasswordForEmail(preview.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
  });
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    message: "If this invitation is still valid, a password reset email is on the way.",
  };
}

export async function continueCreatorInviteSessionAction(
  _prev: CreatorInviteFormState,
  formData: FormData
): Promise<CreatorInviteFormState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, message: CREATOR_INVITE_INVALID_MESSAGE };
  }
  if (password || confirmPassword) {
    const passwordCheck = validateCreatorInvitePassword({
      password,
      confirmPassword,
    });
    if (!passwordCheck.ok) return passwordCheck;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, message: error.message };
  }
  const accepted = await acceptCreatorInviteForUser({
    token,
    userId: user.id,
    authenticatedEmail: user.email,
  });
  if (!accepted.ok) return { ok: false, message: accepted.message };
  redirect("/creator-portal");
}
