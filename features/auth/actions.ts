"use server";

import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { signInSchema } from "./schemas";

export type SignInFormState = {
  error: string | null;
};

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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  const next = sanitizeNextPath(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : null
  );

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
