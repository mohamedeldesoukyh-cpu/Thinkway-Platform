"use server";

import { revalidatePath } from "next/cache";

import {
  createSignedDocumentUrl,
  removeStorageObject,
} from "@/lib/supabase/storage";
import { createSupabaseServerClient, requireRequestUser } from "@/lib/supabase/server";
import { findDuplicateClient } from "@/lib/validation/checks";
import { friendlyActionError } from "@/lib/validation/hierarchy";
import { buildClassificationAuditPayload } from "@/lib/clients/build-classification-audit";
import {
  insertClientWithClassificationAudit,
  updateClientWithClassificationAudit,
  updateClientWithOptionalColumnRetry,
} from "@/lib/clients/classification-audit-columns";
import { upsertClientClassificationCache } from "@/lib/clients/client-classification-cache";
import {
  friendlyClientDocumentError,
  toJsonSafeFormActionState,
} from "@/lib/clients/client-document-utils";
import { assessClientLegalReadiness } from "@/lib/clients/legal-readiness";
import { persistClientDocumentUpload } from "@/lib/clients/persist-client-document-upload";
import { tryCompleteLegalOnboarding } from "@/lib/clients/try-complete-legal-onboarding";
import { tryCompleteTaxOnboarding } from "@/lib/clients/try-complete-tax-onboarding";
import { tryCompleteFinanceOnboarding } from "@/lib/clients/try-complete-finance-onboarding";
import type { ClientOnboardingStatus } from "@/lib/clients/onboarding-status";
import type { AgencyOrDirect, ClientDocumentRow, PaymentTerms } from "@/types/database";

import {
  createClientSchema,
  updateClientCreditLimitSchema,
  updateClientFinanceSchema,
  updateClientLegalSchema,
  updateClientOverviewSchema,
  uploadClientDocumentSchema,
} from "./schemas";
import { parseTermsText, serializeTermsText } from "@/lib/io/client-io-terms";

export type ClientOverviewSavePatch = {
  group_id: string | null;
  group: { id: string; name: string; document_number: string } | null;
  updated_at: string;
};

export type FormActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  document?: ClientDocumentRow;
  /** Fresh persisted overview fields returned after a successful overview save. */
  clientPatch?: ClientOverviewSavePatch;
  legalReadiness?: { complete: boolean; missing: string[] };
  onboardingStatus?: ClientOnboardingStatus;
};

export type CreateClientFormState = FormActionState & { clientId?: string };

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

function normalizeClientIoTermsText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const parsed = parseTermsText(trimmed);
  if (!parsed) {
    throw new Error("Client IO terms must be a valid JSON list of title and body pairs.");
  }
  return serializeTermsText(parsed);
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
      error: error instanceof Error ? error.message : "You must be signed in to continue.",
    };
  }
}

export async function createClientAction(
  _prevState: CreateClientFormState,
  formData: FormData
): Promise<CreateClientFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createClientSchema.safeParse(raw);

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

  try {
    const duplicate = await findDuplicateClient(
      supabase,
      parsed.data.name,
      parsed.data.agency_or_direct as AgencyOrDirect
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

  let clientIoTermsText: string | null = null;
  try {
    clientIoTermsText = normalizeClientIoTermsText(parsed.data.client_io_terms_text);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid client IO terms.",
    };
  }

  const now = new Date().toISOString();
  const audit = buildClassificationAuditPayload(
    {
      clientCategory: parsed.data.client_category,
      clientSubcategory: parsed.data.client_subcategory,
      suggestionAccepted: parsed.data.suggestion_accepted,
      categoryManuallySet: parsed.data.category_manually_set,
      suggestionSource: parsed.data.classification_source,
      suggestionConfidence: parsed.data.classification_confidence,
      suggestionReason: parsed.data.classification_reason,
    },
    user.id,
    now
  );

  const { data, error } = await insertClientWithClassificationAudit(
    supabase,
    {
      name: parsed.data.name,
      name_ar: emptyToNull(parsed.data.name_ar),
      legal_name: emptyToNull(parsed.data.legal_name) ?? parsed.data.name,
      group_id: parsed.data.group_id,
      agency_or_direct: parsed.data.agency_or_direct as AgencyOrDirect,
      industry: emptyToNull(parsed.data.industry),
      client_category: parsed.data.client_category,
      client_subcategory: parsed.data.client_subcategory,
      vr_rate_id: parsed.data.vr_rate_id,
      website: emptyToNull(parsed.data.website),
      status: parsed.data.status,
      billing_email: emptyToNull(parsed.data.billing_email),
      currency: parsed.data.currency,
      country: emptyToNull(parsed.data.country),
      city: emptyToNull(parsed.data.city),
      notes: emptyToNull(parsed.data.notes),
      client_io_terms_text: clientIoTermsText,
      created_by: user.id,
    },
    audit
  );

  if (error || !data) {
    return {
      ok: false,
      message: error
        ? friendlyActionError(error, "client", error.message)
        : "Client could not be created.",
      fieldErrors:
        error && error.code === "23505"
          ? { name: [friendlyActionError(error, "client")] }
          : undefined,
    };
  }

  if (
    parsed.data.client_category &&
    parsed.data.client_subcategory &&
    audit.classification_source &&
    audit.classification_confidence != null
  ) {
    await upsertClientClassificationCache(supabase, {
      companyName: parsed.data.name,
      categorySlug: parsed.data.client_category,
      subcategorySlug: parsed.data.client_subcategory,
      confidence: audit.classification_confidence,
      source: audit.classification_source,
      classificationReason: audit.classification_reason,
      verified: !audit.needs_review,
    });
  }

  revalidatePath("/clients");
  if (parsed.data.group_id) {
    revalidatePath(`/groups/${parsed.data.group_id}`);
  }

  return {
    ok: true,
    message: "Client created successfully.",
    clientId: data.id,
  };
}

export async function updateClientOverviewAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateClientOverviewSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { client_id, ...fields } = parsed.data;

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  try {
    const duplicate = await findDuplicateClient(
      supabase,
      fields.name,
      fields.agency_or_direct as AgencyOrDirect,
      client_id
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

  let clientIoTermsText: string | null = null;
  try {
    clientIoTermsText = normalizeClientIoTermsText(fields.client_io_terms_text);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid client IO terms.",
    };
  }

  const now = new Date().toISOString();
  const audit = buildClassificationAuditPayload(
    {
      clientCategory: fields.client_category,
      clientSubcategory: fields.client_subcategory,
      suggestionAccepted: fields.suggestion_accepted,
      categoryManuallySet: fields.category_manually_set,
      suggestionSource: fields.classification_source,
      suggestionConfidence: fields.classification_confidence,
      suggestionReason: fields.classification_reason,
    },
    user.id,
    now
  );

  const { error } = await updateClientWithClassificationAudit(
    supabase,
    client_id,
    {
      name: fields.name,
      name_ar: emptyToNull(fields.name_ar),
      legal_name: emptyToNull(fields.legal_name),
      group_id: fields.group_id,
      agency_or_direct: fields.agency_or_direct as AgencyOrDirect,
      industry: emptyToNull(fields.industry),
      client_category: fields.client_category,
      client_subcategory: fields.client_subcategory,
      vr_rate_id: fields.vr_rate_id,
      website: emptyToNull(fields.website),
      status: fields.status,
      billing_email: emptyToNull(fields.billing_email),
      billing_phone: emptyToNull(fields.billing_phone),
      country: emptyToNull(fields.country),
      city: emptyToNull(fields.city),
      notes: emptyToNull(fields.notes),
      client_io_terms_text: clientIoTermsText,
    },
    audit
  );

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "client", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "client")] } : undefined,
    };
  }

  if (
    fields.client_category &&
    fields.client_subcategory &&
    audit.classification_source &&
    audit.classification_confidence != null
  ) {
    await upsertClientClassificationCache(supabase, {
      companyName: fields.name,
      categorySlug: fields.client_category,
      subcategorySlug: fields.client_subcategory,
      confidence: audit.classification_confidence,
      source: audit.classification_source,
      classificationReason: audit.classification_reason,
      verified: !audit.needs_review,
    });
  }

  if (fields.group_id) {
    const { error: brandSyncError } = await supabase
      .from("brands")
      .update({ group_id: fields.group_id })
      .eq("client_id", client_id);

    if (brandSyncError) {
      return { ok: false, message: brandSyncError.message };
    }
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/campaigns");
  revalidatePath("/settings/client-classification-review");
  if (fields.group_id) {
    revalidatePath(`/groups/${fields.group_id}`);
  }

  const { refreshed, refreshError } = await fetchSavedClientOverviewPatch(
    supabase,
    client_id
  );

  if (refreshError) {
    console.warn(
      `[clients] overview saved but post-save reload failed for ${client_id}:`,
      refreshError.message
    );
  }

  return {
    ok: true,
    message: "Overview saved.",
    clientPatch: refreshed,
  };
}

async function fetchSavedClientOverviewPatch(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  clientId: string
): Promise<{ refreshed?: ClientOverviewSavePatch; refreshError?: { message: string } }> {
  const groupSelects = [
    "group_id, updated_at, group:groups(id, name, document_number)",
    "group_id, updated_at, group:groups(id, name)",
  ] as const;

  for (const select of groupSelects) {
    const { data, error } = await supabase
      .from("clients")
      .select(select)
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      const isMissingGroupDocumentNumber =
        select.includes("document_number") &&
        error.message.toLowerCase().includes("document_number");
      if (isMissingGroupDocumentNumber) {
        continue;
      }
      return { refreshError: error };
    }

    if (!data) {
      return { refreshError: { message: "Client not found after save." } };
    }

    const embeddedGroup = data.group as unknown as
      | { id: string; name: string; document_number?: string }
      | null
      | undefined;

    return {
      refreshed: {
        group_id: data.group_id ?? embeddedGroup?.id ?? null,
        group: embeddedGroup?.id
          ? {
              id: embeddedGroup.id,
              name: embeddedGroup.name,
              document_number: embeddedGroup.document_number ?? "",
            }
          : null,
        updated_at: data.updated_at,
      },
    };
  }

  const { data, error } = await supabase
    .from("clients")
    .select("group_id, updated_at")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) {
    return {
      refreshError: error ?? { message: "Client not found after save." },
    };
  }

  return {
    refreshed: {
      group_id: data.group_id,
      group: null,
      updated_at: data.updated_at,
    },
  };
}

export async function updateClientLegalAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateClientLegalSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "You must be signed in to continue." };
  }

  const legal_address = {
    line1: parsed.data.legal_address_line1?.trim() || null,
    line2: parsed.data.legal_address_line2?.trim() || null,
    city: parsed.data.legal_address_city?.trim() || null,
    country: parsed.data.legal_address_country?.trim() || null,
    postal_code: parsed.data.legal_address_postal?.trim() || null,
  };

  const { error } = await updateClientWithOptionalColumnRetry(
    supabase,
    parsed.data.client_id,
    {
      trade_license_number: emptyToNull(parsed.data.trade_license_number),
      trade_license_expiry: parsed.data.trade_license_expiry,
      vat_number: emptyToNull(parsed.data.vat_number),
      tax_id: emptyToNull(parsed.data.tax_id),
      legal_address,
    }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  const { data: documents } = await supabase
    .from("client_documents")
    .select("document_type")
    .eq("client_id", parsed.data.client_id);

  const legalReadiness = assessClientLegalReadiness({
    trade_license_number: emptyToNull(parsed.data.trade_license_number),
    trade_license_expiry: parsed.data.trade_license_expiry,
    vat_number: emptyToNull(parsed.data.vat_number),
    legal_address,
    documentTypes: (documents ?? []).map((doc) => doc.document_type),
  });

  const onboardingResult = legalReadiness.complete
    ? await tryCompleteLegalOnboarding({
        supabase,
        clientId: parsed.data.client_id,
        userId: user.id,
      })
    : { completed: false as const };

  const taxOnboardingResult = await tryCompleteTaxOnboarding({
    supabase,
    clientId: parsed.data.client_id,
    userId: user.id,
  });

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/clients");

  const advancedStatus =
    taxOnboardingResult.onboardingStatus ?? onboardingResult.onboardingStatus;

  const message = onboardingResult.completed
    ? advancedStatus === "ready"
      ? "Legal saved. Onboarding advanced to Ready."
      : advancedStatus === "active"
        ? "Legal saved. Onboarding is now Active."
        : "Legal saved. Onboarding advanced to Finance pending."
    : taxOnboardingResult.completed
      ? advancedStatus === "active"
        ? "Legal saved. Onboarding is now Active."
        : "Legal saved. Tax requirements met."
      : legalReadiness.complete
        ? "Legal saved."
        : "Legal saved. Complete the missing items below to advance onboarding.";

  return {
    ok: true,
    message,
    legalReadiness,
    onboardingStatus: advancedStatus,
  };
}

export async function updateClientFinanceAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateClientFinanceSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "You must be signed in to continue." };
  }

  const { error } = await updateClientWithOptionalColumnRetry(
    supabase,
    parsed.data.client_id,
    {
      currency: parsed.data.currency,
      payment_terms: (emptyToNull(parsed.data.payment_terms) ??
        null) as PaymentTerms | null,
      credit_limit: parsed.data.credit_limit ?? null,
      credit_limit_active: parsed.data.credit_limit_active,
      accept_credit_risk: parsed.data.accept_credit_risk,
      billing_email: emptyToNull(parsed.data.billing_email),
      billing_phone: emptyToNull(parsed.data.billing_phone),
    }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  const onboardingResult = !parsed.data.credit_limit_active
    ? await tryCompleteFinanceOnboarding({
        supabase,
        clientId: parsed.data.client_id,
        userId: user.id,
      })
    : { completed: false as const };

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/clients");
  revalidatePath("/finance/credit-limit");

  const message = onboardingResult.completed
    ? "Finance settings saved. Onboarding advanced to Ready."
    : "Finance settings saved.";

  return { ok: true, message };
}

export async function updateClientCreditLimitAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateClientCreditLimitSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "You must be signed in to continue." };
  }

  const { error } = await updateClientWithOptionalColumnRetry(
    supabase,
    parsed.data.client_id,
    {
      credit_limit: parsed.data.credit_limit ?? null,
      credit_limit_active: parsed.data.credit_limit_active,
      accept_credit_risk: parsed.data.accept_credit_risk,
    }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  const onboardingResult = !parsed.data.credit_limit_active
    ? await tryCompleteFinanceOnboarding({
        supabase,
        clientId: parsed.data.client_id,
        userId: user.id,
      })
    : { completed: false as const };

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/clients");
  revalidatePath("/finance/credit-limit");

  const message = onboardingResult.completed
    ? "Credit limit saved. Onboarding advanced to Ready."
    : "Credit limit saved.";

  return { ok: true, message };
}

export async function uploadClientDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  try {
    const clientId = String(formData.get("entity_id") ?? formData.get("client_id") ?? "");
    const documentType = String(formData.get("document_type") ?? "");
    const expiresAt = String(formData.get("expires_at") ?? "");
    const file = formData.get("file");

    const parsed = uploadClientDocumentSchema.safeParse({
      client_id: clientId,
      document_type: documentType,
      expires_at: expiresAt,
    });

    if (!parsed.success) {
      return toJsonSafeFormActionState({
        ok: false,
        message: "Please fix the errors below.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    if (!(file instanceof File) || file.size === 0) {
      return toJsonSafeFormActionState({
        ok: false,
        message: "Please choose a file to upload.",
        fieldErrors: { file: ["File is required"] },
      });
    }

    const { supabase, user, error: authError } = await requireAuthUser();
    if (authError || !user) {
      return toJsonSafeFormActionState({
        ok: false,
        message: authError ?? "Unauthorized",
      });
    }

    const result = await persistClientDocumentUpload({
      supabase,
      userId: user.id,
      clientId: parsed.data.client_id,
      documentType: parsed.data.document_type,
      file,
      expiresAt: parsed.data.expires_at,
    });

    return toJsonSafeFormActionState(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly.";
    return toJsonSafeFormActionState({
      ok: false,
      message: friendlyClientDocumentError(message),
    });
  }
}

export async function deleteClientDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  try {
    const documentId = String(formData.get("document_id") ?? "");
    const clientId = String(formData.get("client_id") ?? "");

    if (!documentId || !clientId) {
      return toJsonSafeFormActionState({
        ok: false,
        message: "Missing document reference.",
      });
    }

    const { supabase, error: authError } = await requireAuthUser();
    if (authError) {
      return toJsonSafeFormActionState({ ok: false, message: authError });
    }

    const { data: doc, error: fetchError } = await supabase
      .from("client_documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (fetchError) {
      return toJsonSafeFormActionState({
        ok: false,
        message: friendlyClientDocumentError(fetchError.message),
      });
    }

    if (!doc) {
      return toJsonSafeFormActionState({ ok: false, message: "Document not found." });
    }

    const { error: deleteRowError } = await supabase
      .from("client_documents")
      .delete()
      .eq("id", documentId);

    if (deleteRowError) {
      return toJsonSafeFormActionState({
        ok: false,
        message: friendlyClientDocumentError(deleteRowError.message),
      });
    }

    try {
      await removeStorageObject({
        supabase,
        bucket: "client-documents",
        storagePath: doc.storage_path,
      });
    } catch {
      // Row removed; storage cleanup is best-effort.
    }

    revalidatePath(`/clients/${clientId}`);

    return toJsonSafeFormActionState({ ok: true, message: "Document removed." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove document.";
    return toJsonSafeFormActionState({
      ok: false,
      message: friendlyClientDocumentError(message),
    });
  }
}

export async function getClientDocumentDownloadUrlAction(
  documentId: string,
  clientId: string
): Promise<{ url?: string; error?: string }> {
  try {
    const { supabase, error: authError } = await requireAuthUser();
    if (authError) {
      return { error: authError };
    }

    const { data: doc, error } = await supabase
      .from("client_documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      return { error: friendlyClientDocumentError(error.message) };
    }

    if (!doc) {
      return { error: "Document not found." };
    }

    const url = await createSignedDocumentUrl({
      supabase,
      bucket: "client-documents",
      storagePath: doc.storage_path,
    });
    return { url };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create download link.";
    return { error: friendlyClientDocumentError(message) };
  }
}

export async function upsertClientCommercialRequirementsAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const clientId = String(formData.get("client_id") ?? "").trim();
  if (!clientId) {
    return { ok: false, message: "Client is required." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const requiredDocumentTypes = String(formData.get("required_document_types") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const legalClauses = String(formData.get("legal_clauses") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text }));

  const payload = {
    client_id: clientId,
    required_document_types: requiredDocumentTypes,
    usage_rights: String(formData.get("usage_rights") ?? "").trim() || null,
    approval_workflow: String(formData.get("approval_workflow") ?? "").trim() || null,
    exclusivity_notes: String(formData.get("exclusivity_notes") ?? "").trim() || null,
    confidentiality_notes:
      String(formData.get("confidentiality_notes") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    legal_clauses: legalClauses,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("client_commercial_requirements")
    .upsert(payload as never, { onConflict: "client_id" });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "Commercial requirements saved." };
}
