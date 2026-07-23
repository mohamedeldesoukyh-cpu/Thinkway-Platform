"use server";

import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { signInSchema } from "./schemas";

export type SignInFormState = {
  error: string | null;
};

function formatSignInError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Sign-in failed. Please try again.";
  }

  const authError = error as {
    message?: string;
    status?: number;
    name?: string;
    code?: string;
  };
  const status = authError.status;
  const message = authError.message?.trim() ?? "";

  if (
    status === 520 ||
    status === 522 ||
    status === 524 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return "Authentication service is temporarily unavailable. Please try again in a minute.";
  }

  if (
    authError.name === "AuthRetryableFetchError" ||
    /fetch failed|network|timeout|ECONNRESET|ENOTFOUND/i.test(message)
  ) {
    return "Cannot reach authentication service. Please try again in a minute.";
  }

  if (message && message !== "{}") {
    return message;
  }

  return "Sign-in failed. Please try again.";
}

export async function signInAction(
  _prevState: SignInFormState,
  formData: FormData
): Promise<SignInFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid credentials.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return { error: formatSignInError(error) };
    }
  } catch (error) {
    return { error: formatSignInError(error) };
  }

  const next = sanitizeNextPath(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : null
  );

  // Prefer framework redirect so the action response stays on the RSC protocol.
  redirect(next);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
