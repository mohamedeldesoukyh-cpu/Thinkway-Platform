"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findDuplicateBrand } from "@/lib/validation/checks";
import { friendlyActionError } from "@/lib/validation/hierarchy";

import {
  archiveBrandSchema,
  createBrandSchema,
  updateBrandSchema,
} from "./schemas";

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

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

function revalidateBrandPaths(clientId: string, groupId: string | null) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  if (groupId) {
    revalidatePath(`/groups/${groupId}`);
  }
  revalidatePath("/campaigns");
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

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
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

  try {
    const duplicate = await findDuplicateBrand(
      supabase,
      parsed.data.name,
      parsed.data.client_id
    );
    if (duplicate) {
      return { ok: false, message: duplicate, fieldErrors: { name: [duplicate] } };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Validation failed.",
    };
  }

  const { error } = await supabase.from("brands").insert({
    client_id: parsed.data.client_id,
    group_id: client.group_id,
    name: parsed.data.name,
    category_id: emptyToNull(parsed.data.category_id),
    subcategory_id: emptyToNull(parsed.data.subcategory_id),
    vr_rate_id: emptyToNull(parsed.data.vr_rate_id),
    currency_code: parsed.data.currency_code,
    country_code: emptyToNull(parsed.data.country_code),
    notes: emptyToNull(parsed.data.notes),
    created_by: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "brand", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "brand")] } : undefined,
    };
  }

  revalidateBrandPaths(parsed.data.client_id, client.group_id);
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

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("group_id, client_id")
    .eq("id", parsed.data.brand_id)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("group_id")
    .eq("id", parsed.data.client_id)
    .maybeSingle();

  if (clientError || !client?.group_id) {
    return { ok: false, message: "Invalid legal entity." };
  }

  try {
    const duplicate = await findDuplicateBrand(
      supabase,
      parsed.data.name,
      parsed.data.client_id,
      parsed.data.brand_id
    );
    if (duplicate) {
      return { ok: false, message: duplicate, fieldErrors: { name: [duplicate] } };
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Validation failed.",
    };
  }

  const { error } = await supabase
    .from("brands")
    .update({
      client_id: parsed.data.client_id,
      group_id: client.group_id,
      name: parsed.data.name,
      status: parsed.data.status,
      category_id: emptyToNull(parsed.data.category_id),
      subcategory_id: emptyToNull(parsed.data.subcategory_id),
      vr_rate_id: emptyToNull(parsed.data.vr_rate_id),
      currency_code: parsed.data.currency_code,
      country_code: emptyToNull(parsed.data.country_code),
      notes: emptyToNull(parsed.data.notes),
    })
    .eq("id", parsed.data.brand_id);

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "brand", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "brand")] } : undefined,
    };
  }

  revalidateBrandPaths(parsed.data.client_id, client.group_id);
  return { ok: true, message: "Brand updated." };
}

export async function archiveBrandAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = archiveBrandSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("group_id, client_id")
    .eq("id", parsed.data.brand_id)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  const { count, error: countError } = await supabase
    .from("campaign_headers")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", parsed.data.brand_id);

  if (countError) {
    return { ok: false, message: countError.message };
  }

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message:
        "This brand cannot be deleted because campaigns are linked to it. Archive instead.",
    };
  }

  const { error } = await supabase
    .from("brands")
    .update({ status: "archived" })
    .eq("id", parsed.data.brand_id)
    .eq("client_id", parsed.data.client_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateBrandPaths(parsed.data.client_id, brand.group_id);
  return { ok: true, message: "Brand archived." };
}
