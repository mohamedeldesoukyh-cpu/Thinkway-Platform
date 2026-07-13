"use server";

import { revalidatePath } from "next/cache";

import {
  getMissingClientColumnFromSchemaError,
  isMissingClientColumnSchemaError,
} from "@/lib/clients/classification-audit-columns";
import { fetchClientVrRateIdSafe } from "@/lib/clients/vr-rate-lookup";
import { normalizeBrandVrRateId } from "@/lib/clients/vr-inheritance";
import { createSupabaseServerClient, requireRequestUser } from "@/lib/supabase/server";
import { findDuplicateBrand } from "@/lib/validation/checks";
import { friendlyActionError } from "@/lib/validation/hierarchy";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  archiveBrandSchema,
  createBrandSchema,
  updateBrandSchema,
  updateBrandStatusSchema,
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
  try {
    const { supabase, user } = await requireRequestUser();
    return { supabase, user, error: null };
  } catch (error) {
    const supabase = await createSupabaseServerClient();
    return {
      supabase,
      user: null,
      error: error instanceof Error ? error.message : "Unauthorized",
    };
  }
}

function revalidateBrandPaths(clientId: string, groupId: string | null) {
  revalidatePath("/brands");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  if (groupId) {
    revalidatePath(`/groups/${groupId}`);
  }
  revalidatePath("/campaigns");
  revalidatePath("/reports/pnl");
}

type ClientBrandContext = {
  group_id: string | null;
  vr_rate_id: string | null;
};

function embeddedGroupId(group: unknown): string | null {
  if (!group || typeof group !== "object") {
    return null;
  }
  const id = (group as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

async function fetchClientBrandContext(
  supabase: SupabaseClient,
  clientId: string
): Promise<
  | { ok: true; client: ClientBrandContext }
  | { ok: false; message: string }
> {
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("group_id, group:groups(id)")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    const missingColumn = getMissingClientColumnFromSchemaError(clientError);
    if (missingColumn && missingColumn !== "group_id") {
      const { data: fallback, error: fallbackError } = await supabase
        .from("clients")
        .select("group_id")
        .eq("id", clientId)
        .maybeSingle();

      if (fallbackError) {
        return { ok: false, message: fallbackError.message };
      }
      if (!fallback) {
        return { ok: false, message: "Legal entity not found." };
      }

      const vrRateId = await fetchClientVrRateIdSafe(supabase, clientId);
      if (vrRateId.error) {
        return { ok: false, message: vrRateId.error };
      }

      return {
        ok: true,
        client: { group_id: fallback.group_id ?? null, vr_rate_id: vrRateId.value },
      };
    }

    return { ok: false, message: clientError.message };
  }

  if (!clientRow) {
    return { ok: false, message: "Legal entity not found." };
  }

  const groupId = clientRow.group_id ?? embeddedGroupId(clientRow.group) ?? null;

  const vrRateId = await fetchClientVrRateIdSafe(supabase, clientId);
  if (vrRateId.error) {
    return { ok: false, message: vrRateId.error };
  }

  return {
    ok: true,
    client: { group_id: groupId, vr_rate_id: vrRateId.value },
  };
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

  const clientResult = await fetchClientBrandContext(supabase, parsed.data.client_id);
  if (!clientResult.ok) {
    return { ok: false, message: clientResult.message };
  }
  const client = clientResult.client;

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

  const vrRateId = normalizeBrandVrRateId(
    emptyToNull(parsed.data.vr_rate_id),
    client.vr_rate_id ?? null
  );

  const { error } = await supabase.from("brands").insert({
    client_id: parsed.data.client_id,
    group_id: client.group_id ?? undefined,
    name: parsed.data.name,
    category_id: emptyToNull(parsed.data.category_id),
    subcategory_id: emptyToNull(parsed.data.subcategory_id),
    vr_rate_id: vrRateId,
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

  const clientResult = await fetchClientBrandContext(supabase, parsed.data.client_id);
  if (!clientResult.ok) {
    return { ok: false, message: clientResult.message };
  }
  const client = clientResult.client;

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

  const vrRateId = normalizeBrandVrRateId(
    emptyToNull(parsed.data.vr_rate_id),
    client.vr_rate_id ?? null
  );

  const { error } = await supabase
    .from("brands")
    .update({
      client_id: parsed.data.client_id,
      group_id: client.group_id ?? undefined,
      name: parsed.data.name,
      status: parsed.data.status,
      category_id: emptyToNull(parsed.data.category_id),
      subcategory_id: emptyToNull(parsed.data.subcategory_id),
      vr_rate_id: vrRateId,
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

  const { error: campaignSyncError } = await supabase
    .from("campaign_headers")
    .update({ vr_rate_id: vrRateId })
    .eq("brand_id", parsed.data.brand_id);

  if (campaignSyncError) {
    return {
      ok: false,
      message: friendlyActionError(campaignSyncError, "brand", campaignSyncError.message),
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
        "This brand cannot be archived because campaigns are linked to it.",
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

export async function updateBrandStatusAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateBrandStatusSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("group_id, status")
    .eq("id", parsed.data.brand_id)
    .eq("client_id", parsed.data.client_id)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false, message: brandError?.message ?? "Brand not found." };
  }

  if (brand.status === "archived") {
    return {
      ok: false,
      message: "Archived brands cannot be toggled. Edit the brand to restore.",
    };
  }

  const { error } = await supabase
    .from("brands")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.brand_id)
    .eq("client_id", parsed.data.client_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateBrandPaths(parsed.data.client_id, brand.group_id);
  return {
    ok: true,
    message:
      parsed.data.status === "active"
        ? "Brand marked active."
        : "Brand marked inactive.",
  };
}
