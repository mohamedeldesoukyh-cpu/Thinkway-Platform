"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { parseCategoriesInput } from "./utils";
import { createVendorSchema } from "./schemas";

export type CreateVendorFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  vendorId?: string;
};

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

export async function createVendorAction(
  _prevState: CreateVendorFormState,
  formData: FormData
): Promise<CreateVendorFormState> {
  const raw = {
    display_name: formData.get("display_name"),
    legal_name: formData.get("legal_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    country_code: formData.get("country_code"),
    categories: formData.get("categories"),
    platform: formData.get("platform"),
    handle: formData.get("handle"),
    follower_count: formData.get("follower_count"),
    pricing_amount: formData.get("pricing_amount"),
    pricing_currency: formData.get("pricing_currency"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  };

  const parsed = createVendorSchema.safeParse(raw);

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
    return { ok: false, message: "You must be signed in to create vendors." };
  }

  const categories = parseCategoriesInput(parsed.data.categories ?? "");
  const rateCard =
    parsed.data.pricing_amount != null
      ? {
          base_rate: parsed.data.pricing_amount,
          currency: parsed.data.pricing_currency,
        }
      : {};

  const { data: vendor, error } = await supabase
    .from("influencers")
    .insert({
      display_name: parsed.data.display_name,
      legal_name: emptyToNull(parsed.data.legal_name),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      country_code: emptyToNull(parsed.data.country_code),
      categories,
      status: parsed.data.status,
      rate_card: rateCard,
      notes: emptyToNull(parsed.data.notes),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  const platform = emptyToNull(parsed.data.platform);
  const handle = emptyToNull(parsed.data.handle);

  if (platform && handle) {
    const { error: platformError } = await supabase
      .from("influencer_platform_accounts")
      .insert({
        influencer_id: vendor.id,
        platform,
        handle,
        follower_count: parsed.data.follower_count ?? 0,
        is_primary: true,
      });

    if (platformError) {
      return { ok: false, message: platformError.message };
    }
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendor.id}`);

  return {
    ok: true,
    message: "Vendor created successfully.",
    vendorId: vendor.id,
  };
}
