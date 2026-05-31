"use server";

import { revalidatePath } from "next/cache";

import { METADATA_PLATFORM_KEY } from "@/features/campaigns/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createCampaignSchema } from "./schemas";

export type CreateCampaignFormState = {
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

export async function createCampaignAction(
  _prevState: CreateCampaignFormState,
  formData: FormData
): Promise<CreateCampaignFormState> {
  const raw = {
    client_id: formData.get("client_id"),
    name: formData.get("name"),
    platform: formData.get("platform"),
    budget: formData.get("budget"),
    currency: formData.get("currency"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    status: formData.get("status"),
    account_manager_id: formData.get("account_manager_id"),
  };

  const parsed = createCampaignSchema.safeParse(raw);

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
    return { ok: false, message: "You must be signed in to create campaigns." };
  }

  const platform = emptyToNull(parsed.data.platform);
  const metadata = platform ? { [METADATA_PLATFORM_KEY]: platform } : {};

  const { error } = await supabase.from("campaigns").insert({
    client_id: parsed.data.client_id,
    name: parsed.data.name,
    status: parsed.data.status,
    budget: parsed.data.budget,
    currency: parsed.data.currency,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    account_manager_id: emptyToNull(parsed.data.account_manager_id),
    metadata,
    created_by: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  revalidatePath("/campaigns");

  return {
    ok: true,
    message: "Campaign created successfully.",
  };
}
