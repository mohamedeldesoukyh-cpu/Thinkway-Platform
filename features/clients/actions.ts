"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createClientSchema } from "./schemas";

export type CreateClientFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

export async function createClientAction(
  _prevState: CreateClientFormState,
  formData: FormData
): Promise<CreateClientFormState> {
  const raw = {
    name: formData.get("name"),
    legal_name: formData.get("legal_name"),
    industry: formData.get("industry"),
    website: formData.get("website"),
    status: formData.get("status"),
    billing_email: formData.get("billing_email"),
    currency: formData.get("currency"),
    notes: formData.get("notes"),
  };

  const parsed = createClientSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { ok: false, message: authError.message };
  }

  if (!user) {
    return { ok: false, message: "You must be signed in to create clients." };
  }

  const { error } = await supabase.from("clients").insert({
    name: parsed.data.name,
    legal_name: emptyToNull(parsed.data.legal_name),
    industry: emptyToNull(parsed.data.industry),
    website: emptyToNull(parsed.data.website),
    status: parsed.data.status,
    billing_email: emptyToNull(parsed.data.billing_email),
    currency: parsed.data.currency,
    notes: emptyToNull(parsed.data.notes),
    created_by: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  revalidatePath("/clients");

  return {
    ok: true,
    message: "Client created successfully.",
  };
}
