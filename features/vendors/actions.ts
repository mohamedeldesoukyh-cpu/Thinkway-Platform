"use server";

import { revalidatePath } from "next/cache";

import {
  createSignedDocumentUrl,
  removeStorageObject,
  uploadEntityDocument,
} from "@/lib/supabase/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ContractStatus,
  ExclusivityType,
  InfluencerGender,
  PaymentTerms,
} from "@/types/database";

import { parseCategoriesInput, parseLanguagesInput } from "./utils";
import {
  archiveVendorSchema,
  createVendorSchema,
  platformAccountInputSchema,
  savePlatformAccountsSchema,
  updateVendorFinanceSchema,
  updateVendorLegalSchema,
  updateVendorOverviewSchema,
  updateVendorStatusSchema,
  uploadInfluencerDocumentSchema,
  vendorDependencySchema,
} from "./schemas";
import { getVendorDependencies } from "@/lib/operations/vendor-dependencies";

export type FormActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type CreateVendorFormState = FormActionState & { vendorId?: string };

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

  if (error) {
    return { supabase, user: null, error: error.message };
  }

  if (!user) {
    return {
      supabase,
      user: null,
      error: "You must be signed in to continue.",
    };
  }

  return { supabase, user, error: null };
}

export async function createVendorAction(
  _prevState: CreateVendorFormState,
  formData: FormData
): Promise<CreateVendorFormState> {
  const parsed = createVendorSchema.safeParse(Object.fromEntries(formData.entries()));

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
        username: handle,
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

export async function updateVendorOverviewAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateVendorOverviewSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

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

  const { error } = await supabase
    .from("influencers")
    .update({
      display_name: parsed.data.display_name,
      legal_name: emptyToNull(parsed.data.legal_name),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      status: parsed.data.status,
      country_code: emptyToNull(parsed.data.country_code),
      city: emptyToNull(parsed.data.city),
      nationality: emptyToNull(parsed.data.nationality),
      gender: (emptyToNull(parsed.data.gender) ?? null) as InfluencerGender | null,
      categories: parseCategoriesInput(parsed.data.categories ?? ""),
      languages: parseLanguagesInput(parsed.data.languages ?? ""),
      influencer_url: emptyToNull(parsed.data.influencer_url),
      management_agency: emptyToNull(parsed.data.management_agency),
      notes: emptyToNull(parsed.data.notes),
    })
    .eq("id", parsed.data.influencer_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${parsed.data.influencer_id}`);

  return { ok: true, message: "Overview saved." };
}

export async function updateVendorLegalAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateVendorLegalSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

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

  const { error } = await supabase
    .from("influencers")
    .update({
      contract_status: parsed.data.contract_status as ContractStatus,
      contract_expiry: parsed.data.contract_expiry,
      exclusivity: (emptyToNull(parsed.data.exclusivity) ??
        null) as ExclusivityType | null,
    })
    .eq("id", parsed.data.influencer_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/vendors/${parsed.data.influencer_id}`);

  return { ok: true, message: "Legal & contract saved." };
}

export async function updateVendorFinanceAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateVendorFinanceSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

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

  const rateCard =
    parsed.data.pricing_amount != null
      ? {
          base_rate: parsed.data.pricing_amount,
          currency: parsed.data.pricing_currency,
        }
      : {};

  const { error } = await supabase
    .from("influencers")
    .update({
      payment_terms: (emptyToNull(parsed.data.payment_terms) ??
        null) as PaymentTerms | null,
      rate_card: rateCard,
      vat_registered: parsed.data.vat_registered ?? false,
      default_vat_percent: parsed.data.default_vat_percent,
      tax_registration_number: emptyToNull(parsed.data.tax_registration_number),
    })
    .eq("id", parsed.data.influencer_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/vendors/${parsed.data.influencer_id}`);

  return { ok: true, message: "Finance saved." };
}

export async function savePlatformAccountsAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = savePlatformAccountsSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid platform data.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let rawAccounts: unknown;
  try {
    rawAccounts = JSON.parse(parsed.data.accounts_json);
  } catch {
    return { ok: false, message: "Invalid platform payload." };
  }

  if (!Array.isArray(rawAccounts)) {
    return { ok: false, message: "Platform accounts must be an array." };
  }

  const accounts = rawAccounts.map((row) =>
    platformAccountInputSchema.parse(row)
  );

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const influencerId = parsed.data.influencer_id;

  const { data: existing, error: fetchError } = await supabase
    .from("influencer_platform_accounts")
    .select("id")
    .eq("influencer_id", influencerId);

  if (fetchError) {
    return { ok: false, message: fetchError.message };
  }

  const existingIds = new Set(existing?.map((row) => row.id) ?? []);
  const submittedIds = new Set(
    accounts.map((a) => a.id).filter((id): id is string => Boolean(id))
  );

  const toDelete = [...existingIds].filter((id) => !submittedIds.has(id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("influencer_platform_accounts")
      .delete()
      .in("id", toDelete);

    if (deleteError) {
      return { ok: false, message: deleteError.message };
    }
  }

  for (const account of accounts) {
    const audience_gender_split = {
      male: account.audience_male_pct,
      female: account.audience_female_pct,
    };

    const payload = {
      influencer_id: influencerId,
      platform: account.platform,
      handle: account.username,
      username: account.username,
      profile_url: emptyToNull(account.profile_url),
      follower_count: account.follower_count,
      engagement_rate: account.engagement_rate,
      avg_views: account.avg_views,
      audience_country: emptyToNull(account.audience_country),
      audience_gender_split,
      is_primary: account.is_primary ?? false,
    };

    if (account.id) {
      const { error } = await supabase
        .from("influencer_platform_accounts")
        .update(payload)
        .eq("id", account.id);

      if (error) {
        return { ok: false, message: error.message };
      }
    } else {
      const { error } = await supabase
        .from("influencer_platform_accounts")
        .insert(payload);

      if (error) {
        return { ok: false, message: error.message };
      }
    }
  }

  revalidatePath(`/vendors/${influencerId}`);

  return { ok: true, message: "Platform accounts saved." };
}

export async function uploadInfluencerDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const influencerId = String(
    formData.get("entity_id") ?? formData.get("influencer_id") ?? ""
  );
  const documentType = String(formData.get("document_type") ?? "");
  const expiresAt = String(formData.get("expires_at") ?? "");
  const file = formData.get("file");

  const parsed = uploadInfluencerDocumentSchema.safeParse({
    influencer_id: influencerId,
    document_type: documentType,
    expires_at: expiresAt,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Please choose a file to upload.",
      fieldErrors: { file: ["File is required"] },
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  try {
    const uploaded = await uploadEntityDocument({
      supabase,
      bucket: "influencer-documents",
      entityId: parsed.data.influencer_id,
      documentType: parsed.data.document_type,
      file,
    });

    const { error } = await supabase.from("influencer_documents").insert({
      influencer_id: parsed.data.influencer_id,
      document_type: parsed.data.document_type,
      file_name: file.name,
      storage_path: uploaded.storagePath,
      mime_type: uploaded.mimeType,
      file_size: uploaded.fileSize,
      expires_at: parsed.data.expires_at,
      uploaded_by: user.id,
    });

    if (error) {
      await removeStorageObject({
        supabase,
        bucket: "influencer-documents",
        storagePath: uploaded.storagePath,
      });
      return { ok: false, message: error.message };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Upload failed.",
    };
  }

  revalidatePath(`/vendors/${parsed.data.influencer_id}`);

  return { ok: true, message: "Document uploaded." };
}

export async function deleteInfluencerDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const documentId = String(formData.get("document_id") ?? "");
  const influencerId = String(formData.get("influencer_id") ?? "");

  if (!documentId || !influencerId) {
    return { ok: false, message: "Missing document reference." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: doc, error: fetchError } = await supabase
    .from("influencer_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("influencer_id", influencerId)
    .maybeSingle();

  if (fetchError || !doc) {
    return { ok: false, message: fetchError?.message ?? "Document not found." };
  }

  const { error: deleteRowError } = await supabase
    .from("influencer_documents")
    .delete()
    .eq("id", documentId);

  if (deleteRowError) {
    return { ok: false, message: deleteRowError.message };
  }

  try {
    await removeStorageObject({
      supabase,
      bucket: "influencer-documents",
      storagePath: doc.storage_path,
    });
  } catch {
    // best-effort
  }

  revalidatePath(`/vendors/${influencerId}`);

  return { ok: true, message: "Document removed." };
}

export async function getInfluencerDocumentDownloadUrlAction(
  documentId: string,
  influencerId: string
): Promise<{ url?: string; error?: string }> {
  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { error: authError };
  }

  const { data: doc, error } = await supabase
    .from("influencer_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("influencer_id", influencerId)
    .maybeSingle();

  if (error || !doc) {
    return { error: error?.message ?? "Document not found." };
  }

  try {
    const url = await createSignedDocumentUrl({
      supabase,
      bucket: "influencer-documents",
      storagePath: doc.storage_path,
    });
    return { url };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not create download link.",
    };
  }
}

export type VendorDependencyState = FormActionState & {
  dependencies?: Awaited<ReturnType<typeof getVendorDependencies>>;
};

export async function getVendorDependenciesAction(
  _prev: VendorDependencyState,
  formData: FormData
): Promise<VendorDependencyState> {
  const parsed = vendorDependencySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  try {
    const dependencies = await getVendorDependencies(
      supabase,
      parsed.data.vendor_id
    );
    return { ok: true, dependencies };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Dependency check failed.",
    };
  }
}

export async function archiveVendorAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = archiveVendorSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const deps = await getVendorDependencies(supabase, parsed.data.vendor_id);
  if (!deps.can_archive) {
    return {
      ok: false,
      message:
        "Cannot archive — active campaign assignments exist. Reassign via Operations → Move first.",
    };
  }

  const { error } = await supabase
    .from("influencers")
    .update({ status: "archived" })
    .eq("id", parsed.data.vendor_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${parsed.data.vendor_id}`);
  return { ok: true, message: "Vendor archived." };
}

export async function updateVendorStatusAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateVendorStatusSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { error } = await supabase
    .from("influencers")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.vendor_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${parsed.data.vendor_id}`);
  return { ok: true, message: "Vendor status updated." };
}
