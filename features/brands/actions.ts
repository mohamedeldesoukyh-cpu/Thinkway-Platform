"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AgencyOrDirect } from "@/types/database";

import { createBrandSchema, updateBrandSchema } from "./schemas";

export type FormActionState = {
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

export async function createBrandAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createBrandSchema.safeParse(Object.fromEntries(formData.entries()));

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

  if (authError || !user) {
    return { ok: false, message: authError?.message ?? "Unauthorized" };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("group_id")
    .eq("id", parsed.data.client_id)
    .maybeSingle();

  if (clientError || !client?.group_id) {
    return {
      ok: false,
      message: "Client must belong to a group before adding brands.",
    };
  }

  const { error } = await supabase.from("brands").insert({
    client_id: parsed.data.client_id,
    group_id: client.group_id,
    name: parsed.data.name,
    category_id: emptyToNull(parsed.data.category_id),
    subcategory_id: emptyToNull(parsed.data.subcategory_id),
    agency_or_direct: (emptyToNull(parsed.data.agency_or_direct) ??
      null) as AgencyOrDirect | null,
    vr_rate_id: emptyToNull(parsed.data.vr_rate_id),
    currency_code: parsed.data.currency_code,
    country_code: emptyToNull(parsed.data.country_code),
    notes: emptyToNull(parsed.data.notes),
    created_by: user.id,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath(`/groups/${client.group_id}`);

  return { ok: true, message: "Brand created." };
}

export async function updateBrandAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateBrandSchema.safeParse(Object.fromEntries(formData.entries()));

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

  if (authError || !user) {
    return { ok: false, message: authError?.message ?? "Unauthorized" };
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("group_id, client_id")
    .eq("id", parsed.data.brand_id)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  const { error } = await supabase
    .from("brands")
    .update({
      client_id: parsed.data.client_id,
      name: parsed.data.name,
      status: parsed.data.status,
      category_id: emptyToNull(parsed.data.category_id),
      subcategory_id: emptyToNull(parsed.data.subcategory_id),
      agency_or_direct: (emptyToNull(parsed.data.agency_or_direct) ??
        null) as AgencyOrDirect | null,
      vr_rate_id: emptyToNull(parsed.data.vr_rate_id),
      currency_code: parsed.data.currency_code,
      country_code: emptyToNull(parsed.data.country_code),
      notes: emptyToNull(parsed.data.notes),
    })
    .eq("id", parsed.data.brand_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${brand.client_id}`);
  revalidatePath(`/groups/${brand.group_id}`);

  return { ok: true, message: "Brand updated." };
}
