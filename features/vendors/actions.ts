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
  updateVendorBankDetailsSchema,
  updateVendorFinanceSchema,
  updateVendorLegalSchema,
  updateVendorOverviewSchema,
  updateVendorStatusSchema,
  uploadInfluencerDocumentSchema,
  vendorDependencySchema,
} from "./schemas";
import { getVendorDependencies } from "@/lib/operations/vendor-dependencies";
import { findDuplicatePlatformAccounts } from "@/lib/social/duplicate-check";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import { resolvePlatformAccountFields } from "@/lib/social/parse-profile-url";

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

export async function setInfluencerProfileLinkAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const profileId = String(formData.get("profile_id") ?? "").trim();

  if (!influencerId) {
    return { ok: false, message: "Vendor is required." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { error: updateError } = await supabase
    .from("influencers")
    .update({ profile_id: profileId || null } as never)
    .eq("id", influencerId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${influencerId}`);
  revalidatePath("/creator-portal");

  return {
    ok: true,
    message: profileId
      ? "Creator portal login linked."
      : "Creator portal login unlinked.",
  };
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
  const profileUrl = emptyToNull(parsed.data.profile_url);

  const resolved =
    resolvePlatformAccountFields({
      profile_url: profileUrl ?? undefined,
      username: handle ?? undefined,
      platform: platform ?? undefined,
    }) ?? null;

  const accountPlatform = resolved?.platform ?? platform;
  const accountUsername = resolved?.username ?? handle;

  if (accountPlatform && accountUsername) {
    let enrichment = null;
    const enrichUrl = resolved?.profile_url ?? profileUrl ?? undefined;

    if (enrichUrl) {
      try {
        enrichment = await enrichCreatorProfile({
          platform: accountPlatform as Parameters<
            typeof enrichCreatorProfile
          >[0]["platform"],
          username: accountUsername,
          profile_url: enrichUrl,
        });
      } catch {
        // Enrichment must not block vendor creation.
      }
    }

    const metricsSource = parsed.data.follower_count != null
      ? "manual"
      : resolveMetricsSourceForEnrichment({
          platform: accountPlatform,
          follower_count: enrichment?.follower_count ?? null,
          engagement_rate: enrichment?.engagement_rate ?? null,
          avg_views: enrichment?.avg_views ?? null,
          sync_status: enrichment?.sync_status ?? (resolved ? "partial" : "manual"),
        });

    const normalized = buildNormalizedPlatformAccount({
      platform: accountPlatform,
      username: accountUsername,
      profile_url: resolved?.profile_url ?? profileUrl,
      follower_count:
        parsed.data.follower_count ?? enrichment?.follower_count ?? null,
      following_count: enrichment?.following_count ?? null,
      engagement_rate: enrichment?.engagement_rate ?? null,
      avg_views: enrichment?.avg_views ?? null,
      profile_display_name: enrichment?.display_name ?? null,
      profile_bio: enrichment?.bio ?? null,
      profile_picture_url: enrichment?.profile_picture_url ?? null,
      is_verified: enrichment?.is_verified ?? false,
      sync_status: enrichment?.sync_status ?? (resolved ? "partial" : "manual"),
      sync_source: enrichment?.sync_source ?? (resolved ? "url_parse" : "manual"),
      sync_error: enrichment?.sync_error ?? null,
      last_synced_at: enrichment ? new Date().toISOString() : null,
      metrics_source: metricsSource,
      metrics_last_synced_at: enrichment ? new Date().toISOString() : null,
      metrics_is_manual_override: parsed.data.follower_count != null,
    });

    const { error: platformError } = await supabase
      .from("influencer_platform_accounts")
      .insert({
        influencer_id: vendor.id,
        platform: normalized.platform,
        handle: normalized.handle,
        username: normalized.username,
        profile_url: normalized.profile_url,
        normalized_username: normalized.normalized_username,
        normalized_profile_url: normalized.normalized_profile_url,
        profile_display_name: normalized.profile_display_name,
        profile_bio: normalized.profile_bio,
        profile_picture_url: normalized.profile_picture_url,
        follower_count: normalized.follower_count,
        following_count: normalized.following_count,
        engagement_rate: normalized.engagement_rate,
        avg_views: normalized.avg_views,
        is_verified: normalized.is_verified,
        sync_status: normalized.sync_status,
        sync_source: normalized.sync_source,
        sync_error: normalized.sync_error,
        last_synced_at: normalized.last_synced_at,
        metrics_source: normalized.metrics_source,
        metrics_last_synced_at: normalized.metrics_last_synced_at,
        metrics_is_manual_override: normalized.metrics_is_manual_override,
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

  return { ok: true, message: "Rate card saved." };
}

export async function updateVendorBankDetailsAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateVendorBankDetailsSchema.safeParse(
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

  const { data: existing, error: loadError } = await supabase
    .from("influencers")
    .select("payment_details")
    .eq("id", parsed.data.influencer_id)
    .maybeSingle();

  if (loadError || !existing) {
    return {
      ok: false,
      message: loadError?.message ?? "Vendor not found.",
    };
  }

  const currentDetails =
    ((existing as { payment_details?: Record<string, unknown> }).payment_details ??
      {}) as Record<string, unknown>;

  const paymentDetails: Record<string, unknown> = {
    ...currentDetails,
    beneficiary_name: emptyToNull(parsed.data.beneficiary_name),
    method: emptyToNull(parsed.data.payment_method) ?? "bank_transfer",
    bank_name: emptyToNull(parsed.data.bank_name),
    bank_branch: emptyToNull(parsed.data.bank_branch),
    account_number: emptyToNull(parsed.data.account_number),
    swift: emptyToNull(parsed.data.swift),
    iban: emptyToNull(parsed.data.iban)?.replace(/\s/g, "").toUpperCase() ?? null,
  };

  const { error: updateError } = await supabase
    .from("influencers")
    .update({
      payment_details: paymentDetails,
      payment_terms: (emptyToNull(parsed.data.payment_terms) ??
        null) as PaymentTerms | null,
    } as never)
    .eq("id", parsed.data.influencer_id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  revalidatePath(`/vendors/${parsed.data.influencer_id}`);
  revalidatePath("/vendors");
  revalidatePath("/ios/vendor");

  return { ok: true, message: "Bank details saved." };
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

    const normalized = buildNormalizedPlatformAccount({
      platform: account.platform,
      username: account.username,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      following_count: account.following_count,
      engagement_rate: account.engagement_rate,
      avg_views: account.avg_views,
      is_verified: account.is_verified ?? false,
      profile_display_name: emptyToNull(account.profile_display_name),
      profile_bio: emptyToNull(account.profile_bio),
      profile_picture_url: emptyToNull(account.profile_picture_url),
      sync_status: account.sync_status ?? "manual",
      sync_source: emptyToNull(account.sync_source),
      sync_error: emptyToNull(account.sync_error),
      last_synced_at: emptyToNull(account.last_synced_at),
      metrics_source: account.metrics_source ?? "unavailable",
      metrics_last_synced_at: emptyToNull(account.metrics_last_synced_at),
      metrics_is_manual_override: account.metrics_is_manual_override ?? false,
    });

    const duplicates = await findDuplicatePlatformAccounts(supabase, {
      platform: normalized.platform,
      normalized_username: normalized.normalized_username,
      normalized_profile_url: normalized.normalized_profile_url,
      exclude_influencer_id: influencerId,
      exclude_account_id: account.id ?? null,
    });

    if (duplicates.length > 0) {
      return {
        ok: false,
        message: `${normalized.platform} @${normalized.username} already exists on ${duplicates[0].influencer_name}.`,
      };
    }

    const payload = {
      influencer_id: influencerId,
      platform: normalized.platform,
      handle: normalized.handle,
      username: normalized.username,
      profile_url: normalized.profile_url,
      normalized_username: normalized.normalized_username,
      normalized_profile_url: normalized.normalized_profile_url,
      profile_display_name: normalized.profile_display_name,
      profile_bio: normalized.profile_bio,
      profile_picture_url: normalized.profile_picture_url,
      follower_count: normalized.follower_count,
      following_count: normalized.following_count,
      engagement_rate: normalized.engagement_rate,
      avg_views: normalized.avg_views,
      audience_country: emptyToNull(account.audience_country),
      audience_gender_split,
      is_verified: normalized.is_verified,
      is_primary: account.is_primary ?? false,
      sync_status: normalized.sync_status,
      sync_source: normalized.sync_source,
      last_synced_at: normalized.last_synced_at,
      sync_error: normalized.sync_error,
      metrics_source: normalized.metrics_source,
      metrics_last_synced_at: normalized.metrics_last_synced_at,
      metrics_is_manual_override: normalized.metrics_is_manual_override,
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
