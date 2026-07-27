"use server";

import { revalidatePath } from "next/cache";

import {
  createSignedDocumentUrl,
  removeStorageObject,
  uploadEntityDocument,
} from "@/lib/supabase/storage";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient, requireRequestUser } from "@/lib/supabase/server";
import type {
  ContractStatus,
  ExclusivityType,
  InfluencerGender,
  PaymentTerms,
} from "@/types/database";

import { parseCategoriesInput, parseLanguagesInput } from "./utils";
import { requireCreatorBaselineDna } from "@/features/creator-dna/services/baseline-dna-populator";
import {
  countryWritePayload,
  persistInfluencerCountryFields,
} from "@/lib/creators/country-persistence";
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
import { ensureCommercialCreator } from "@/lib/creators/crm/ensure-commercial-creator";
import { refreshCommercialCreatorCompleteness } from "@/lib/creators/crm/completeness";
import { canConvertToCommercialCreator } from "@/lib/creators/crm/permissions";

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
  try {
    const { supabase, user, roleSlug } = await requireRequestUser();
    return { supabase, user, roleSlug, error: null };
  } catch (error) {
    const supabase = await createSupabaseServerClient();
    return {
      supabase,
      user: null,
      roleSlug: null as string | null,
      error: error instanceof Error ? error.message : "You must be signed in to continue.",
    };
  }
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

  const { supabase, user, roleSlug, error: authError } = await requireAuthUser();
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
  const countryWrite = persistInfluencerCountryFields({
    incomingCodes: [emptyToNull(parsed.data.country_code)],
    preferredPrimary: emptyToNull(parsed.data.country_code),
    preserveExistingPrimary: false,
  });

  const { data: vendor, error } = await supabase
    .from("influencers")
    .insert({
      display_name: parsed.data.display_name,
      legal_name: emptyToNull(parsed.data.legal_name),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      ...(countryWritePayload(countryWrite)),
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
        ...(normalized.profile_picture_url
          ? {
              avatar_source: enrichment?.profile_picture_url ? "discovery" : "manual",
              avatar_last_synced_at: new Date().toISOString(),
            }
          : {}),
      });

    if (platformError) {
      return { ok: false, message: platformError.message };
    }
  }

  try {
    await requireCreatorBaselineDna(supabase, vendor.id);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Creator DNA baseline failed — vendor cannot be created without DNA.";
    return { ok: false, message };
  }

  const crm = await ensureCommercialCreator(supabase, {
    influencerId: vendor.id,
    reason: "manual_create",
    actorId: user.id,
    roleSlug,
    sourceEntityType: "influencer",
    sourceEntityId: vendor.id,
    initialStatus: "incomplete",
    metadata: {
      path: "createVendorAction",
      source: profileUrl ? "url" : "manual",
    },
  });
  if (!crm.ok) {
    return { ok: false, message: crm.message };
  }
  if (!crm.writersDisabled) {
    await refreshCommercialCreatorCompleteness(supabase, vendor.id);
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendor.id}`);

  return {
    ok: true,
    message: "Commercial creator created successfully.",
    vendorId: vendor.id,
  };
}

/**
 * Add an existing identity (Discovery / shortlist / quotation creator) to Commercial CRM.
 * Does not create a new influencer row.
 */
export async function convertInfluencerToCommercialCrmAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState & { vendorId?: string }> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const source = String(formData.get("source") ?? "discovery").trim();
  if (!influencerId) {
    return { ok: false, message: "Creator is required." };
  }

  const { supabase, user, roleSlug, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  if (!canConvertToCommercialCreator(roleSlug)) {
    return {
      ok: false,
      message:
        "Only Account Manager, Operations, Admin, or Super Admin may add creators to CRM.",
    };
  }

  const reason =
    source === "shortlist"
      ? ("manual_convert" as const)
      : source === "quotation"
        ? ("manual_convert" as const)
        : ("manual_convert" as const);

  const crm = await ensureCommercialCreator(supabase, {
    influencerId,
    reason,
    actorId: user.id,
    roleSlug,
    sourceEntityType: source,
    sourceEntityId: influencerId,
    initialStatus: "incomplete",
    metadata: { path: "convertInfluencerToCommercialCrmAction", source },
  });

  if (!crm.ok) {
    return { ok: false, message: crm.message };
  }
  if (!crm.writersDisabled) {
    await refreshCommercialCreatorCompleteness(supabase, influencerId);
  }

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${influencerId}`);
  return {
    ok: true,
    message: crm.created
      ? "Creator added to Commercial CRM."
      : "Creator already in Commercial CRM.",
    vendorId: influencerId,
  };
}

export async function updateVendorCommercialCrmAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) {
    return { ok: false, message: "Creator is required." };
  }

  const preferredCurrency = String(formData.get("preferred_currency") ?? "")
    .trim()
    .toUpperCase();
  const negotiationNotes = String(formData.get("negotiation_notes") ?? "").trim();
  const commercialNotes = String(formData.get("commercial_notes") ?? "").trim();
  const baseRateRaw = String(formData.get("base_rate") ?? "").trim();

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: existing, error: loadError } = await supabase
    .from("influencers")
    .select("rate_card")
    .eq("id", influencerId)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Creator not found." };
  }

  const rateCard = {
    ...(((existing as { rate_card?: Record<string, unknown> }).rate_card ??
      {}) as Record<string, unknown>),
  };
  if (baseRateRaw) {
    const parsedRate = Number(baseRateRaw);
    if (Number.isFinite(parsedRate)) rateCard.base_rate = parsedRate;
  }
  if (preferredCurrency) rateCard.currency = preferredCurrency;
  if (commercialNotes) rateCard.commercial_notes = commercialNotes;
  else delete rateCard.commercial_notes;

  const { error: influencerError } = await supabase
    .from("influencers")
    .update({ rate_card: rateCard } as never)
    .eq("id", influencerId);

  if (influencerError) {
    return { ok: false, message: influencerError.message };
  }

  const { data: crmRow } = await supabase
    .from("creator_crm_profiles")
    .select("influencer_id")
    .eq("influencer_id", influencerId)
    .maybeSingle();

  if (crmRow) {
    await supabase
      .from("creator_crm_profiles")
      .update({
        preferred_currency: preferredCurrency || null,
        negotiation_notes: negotiationNotes || null,
      } as never)
      .eq("influencer_id", influencerId);
  }

  await refreshCommercialCreatorCompleteness(supabase, influencerId);
  revalidatePath(`/vendors/${influencerId}`);
  return { ok: true, message: "Commercial details saved." };
}

export async function upsertInfluencerBankAccountAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  if (!influencerId) {
    return { ok: false, message: "Creator is required." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const isDefault = formData.get("is_default") === "true";
  const isVerified = formData.get("is_verified") === "true";
  const relationshipType = emptyToNull(
    String(formData.get("relationship_type") ?? "")
  );
  const relationshipDescription = emptyToNull(
    String(formData.get("relationship_description") ?? "")
  );
  if (relationshipType === "other" && !relationshipDescription) {
    return {
      ok: false,
      message: "Relationship Description is required when Relationship is Other.",
    };
  }
  const beneficiaryName = emptyToNull(
    String(formData.get("beneficiary_name") ?? "")
  );
  const accountHolder =
    emptyToNull(String(formData.get("account_holder") ?? "")) ?? beneficiaryName;
  const payload = {
    influencer_id: influencerId,
    bank_name: emptyToNull(String(formData.get("bank_name") ?? "")),
    account_holder: accountHolder,
    beneficiary_name: beneficiaryName ?? accountHolder,
    relationship_type: relationshipType,
    relationship_description:
      relationshipType === "other" ? relationshipDescription : relationshipDescription,
    iban:
      emptyToNull(String(formData.get("iban") ?? ""))
        ?.replace(/\s/g, "")
        .toUpperCase() ?? null,
    account_number: emptyToNull(String(formData.get("account_number") ?? "")),
    swift: emptyToNull(String(formData.get("swift") ?? "")),
    currency:
      emptyToNull(String(formData.get("currency") ?? ""))?.toUpperCase() ?? null,
    branch_name: emptyToNull(String(formData.get("branch_name") ?? "")),
    address: emptyToNull(String(formData.get("address") ?? "")),
    routing_number: emptyToNull(String(formData.get("routing_number") ?? "")),
    sort_code: emptyToNull(String(formData.get("sort_code") ?? "")),
    national_id: emptyToNull(String(formData.get("national_id") ?? "")),
    tax_number: emptyToNull(String(formData.get("tax_number") ?? "")),
    notes: emptyToNull(String(formData.get("notes") ?? "")),
    is_default: isDefault,
    is_verified: isVerified,
  };

  if (isDefault) {
    await supabase
      .from("influencer_bank_accounts")
      .update({ is_default: false } as never)
      .eq("influencer_id", influencerId);
  }

  const { error } = await supabase
    .from("influencer_bank_accounts")
    .insert(payload as never);

  if (error) {
    return { ok: false, message: error.message };
  }

  await refreshCommercialCreatorCompleteness(supabase, influencerId);
  revalidatePath(`/vendors/${influencerId}`);
  return { ok: true, message: "Bank account saved." };
}

export async function saveSignedIoExternalLinkAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const vendorIoId = String(formData.get("vendor_io_id") ?? "").trim();
  const assignmentId = String(formData.get("assignment_id") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim() || "other";
  const fileName = String(formData.get("file_name") ?? "").trim() || null;

  if (!influencerId || !vendorIoId || !url) {
    return { ok: false, message: "Vendor IO and URL are required." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { error } = await supabase.from("vendor_io_signed_artifacts").insert({
    vendor_io_id: vendorIoId,
    influencer_id: influencerId,
    artifact_kind: "external_link",
    provider,
    file_name: fileName,
    url,
    version_label: "signed",
    uploaded_by: user.id,
  } as never);

  if (error) {
    return { ok: false, message: error.message };
  }

  const { logVendorPaymentTimelineEvent } = await import(
    "@/lib/creators/crm/payment-timeline"
  );
  await logVendorPaymentTimelineEvent(supabase, {
    influencerId,
    assignmentId,
    vendorIoId,
    eventType: "signed_io_linked",
    summary: `Signed IO linked (${provider})`,
    actorId: user.id,
    metadata: { url, fileName },
  });

  revalidatePath(`/vendors/${influencerId}`);
  return { ok: true, message: "Signed IO link saved." };
}

export async function logVendorIoCommunicationAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const vendorIoId = String(formData.get("vendor_io_id") ?? "").trim() || null;
  const assignmentId = String(formData.get("assignment_id") ?? "").trim() || null;
  const channel = String(formData.get("channel") ?? "manual").trim();
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim() || null;

  if (!influencerId) {
    return { ok: false, message: "Creator is required." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { error } = await supabase.from("vendor_io_communications").insert({
    influencer_id: influencerId,
    vendor_io_id: vendorIoId,
    assignment_id: assignmentId,
    channel,
    direction: "outbound",
    subject,
    body,
    logged_by: user.id,
  } as never);

  if (error) {
    return { ok: false, message: error.message };
  }

  const { logVendorPaymentTimelineEvent } = await import(
    "@/lib/creators/crm/payment-timeline"
  );
  await logVendorPaymentTimelineEvent(supabase, {
    influencerId,
    assignmentId,
    vendorIoId,
    eventType: "communication_logged",
    summary: `Communication logged · ${channel.replace(/_/g, " ")}`,
    actorId: user.id,
    metadata: { subject },
  });

  revalidatePath(`/vendors/${influencerId}`);
  return { ok: true, message: "Communication logged." };
}

export async function setDefaultVerifiedBankAccountAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const bankAccountId = String(formData.get("bank_account_id") ?? "").trim();
  if (!influencerId || !bankAccountId) {
    return { ok: false, message: "Bank account is required." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  await supabase
    .from("influencer_bank_accounts")
    .update({ is_default: false } as never)
    .eq("influencer_id", influencerId);

  const { error } = await supabase
    .from("influencer_bank_accounts")
    .update({ is_default: true, is_verified: true } as never)
    .eq("id", bankAccountId)
    .eq("influencer_id", influencerId);

  if (error) {
    return { ok: false, message: error.message };
  }

  await refreshCommercialCreatorCompleteness(supabase, influencerId);
  revalidatePath(`/vendors/${influencerId}`);
  return { ok: true, message: "Verified default bank account set." };
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

  const permission = await requirePermission(supabase, "influencers.write");
  if ("error" in permission) {
    return { ok: false, message: permission.error };
  }

  const { data: existing } = await supabase
    .from("influencers")
    .select("country_code, country_codes")
    .eq("id", parsed.data.influencer_id)
    .maybeSingle();

  const countryWrite = persistInfluencerCountryFields({
    existingCountryCode: existing?.country_code,
    existingCountryCodes: existing?.country_codes,
    incomingCodes: [emptyToNull(parsed.data.country_code)],
    preferredPrimary: emptyToNull(parsed.data.country_code),
    preserveExistingPrimary: false,
  });

  let vendorIoTermsText: string | null = null;
  try {
    const { normalizeIoTermsText } = await import("@/lib/io/client-io-terms");
    const raw = parsed.data.vendor_io_terms_text?.trim() ?? "";
    if (raw) {
      vendorIoTermsText = normalizeIoTermsText(raw);
      if (!vendorIoTermsText) {
        return {
          ok: false,
          message: "Vendor IO terms must be a valid JSON list of title and body pairs.",
        };
      }
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid Vendor IO terms.",
    };
  }

  const { error } = await supabase
    .from("influencers")
    .update({
      display_name: parsed.data.display_name,
      legal_name: emptyToNull(parsed.data.legal_name),
      email: emptyToNull(parsed.data.email),
      phone: emptyToNull(parsed.data.phone),
      status: parsed.data.status,
      ...(countryWritePayload(countryWrite)),
      city: emptyToNull(parsed.data.city),
      nationality: emptyToNull(parsed.data.nationality),
      gender: (emptyToNull(parsed.data.gender) ?? null) as InfluencerGender | null,
      categories: parseCategoriesInput(parsed.data.categories ?? ""),
      languages: parseLanguagesInput(parsed.data.languages ?? ""),
      influencer_url: emptyToNull(parsed.data.influencer_url),
      management_agency: emptyToNull(parsed.data.management_agency),
      notes: emptyToNull(parsed.data.notes),
      vendor_io_terms_text: vendorIoTermsText,
    } as never)
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

  // Keep multi-account table in sync with IO-linked legacy payment_details.
  const { data: existingBanks } = await supabase
    .from("influencer_bank_accounts")
    .select("id")
    .eq("influencer_id", parsed.data.influencer_id)
    .limit(1);

  if (!existingBanks?.length) {
    await supabase.from("influencer_bank_accounts").insert({
      influencer_id: parsed.data.influencer_id,
      bank_name: paymentDetails.bank_name,
      account_holder: paymentDetails.beneficiary_name,
      iban: paymentDetails.iban,
      account_number: paymentDetails.account_number,
      swift: paymentDetails.swift,
      is_default: true,
      is_verified: false,
    } as never);
  }

  await refreshCommercialCreatorCompleteness(supabase, parsed.data.influencer_id);
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
      ...(normalized.profile_picture_url
        ? { avatar_source: "manual" as const, avatar_last_synced_at: new Date().toISOString() }
        : {}),
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
