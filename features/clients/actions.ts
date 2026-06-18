"use server";

import { revalidatePath } from "next/cache";

import {
  createSignedDocumentUrl,
  removeStorageObject,
  uploadEntityDocument,
} from "@/lib/supabase/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findDuplicateClient } from "@/lib/validation/checks";
import { friendlyActionError } from "@/lib/validation/hierarchy";
import type { AgencyOrDirect, PaymentTerms } from "@/types/database";

import {
  createClientSchema,
  updateClientCreditLimitSchema,
  updateClientFinanceSchema,
  updateClientLegalSchema,
  updateClientOverviewSchema,
  uploadClientDocumentSchema,
} from "./schemas";
import { parseTermsText, serializeTermsText } from "@/lib/io/client-io-terms";

export type FormActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
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

  const { data, error } = await supabase
    .from("clients")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "client", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "client")] } : undefined,
    };
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

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { client_id, ...fields } = parsed.data;

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

  const { error } = await supabase
    .from("clients")
    .update({
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
    })
    .eq("id", client_id);

  if (error) {
    return {
      ok: false,
      message: friendlyActionError(error, "client", error.message),
      fieldErrors: error.code === "23505" ? { name: [friendlyActionError(error, "client")] } : undefined,
    };
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
  if (fields.group_id) {
    revalidatePath(`/groups/${fields.group_id}`);
  }

  return { ok: true, message: "Overview saved." };
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

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const legal_address = {
    line1: parsed.data.legal_address_line1?.trim() || null,
    line2: parsed.data.legal_address_line2?.trim() || null,
    city: parsed.data.legal_address_city?.trim() || null,
    country: parsed.data.legal_address_country?.trim() || null,
    postal_code: parsed.data.legal_address_postal?.trim() || null,
  };

  const { error } = await supabase
    .from("clients")
    .update({
      trade_license_number: emptyToNull(parsed.data.trade_license_number),
      trade_license_expiry: parsed.data.trade_license_expiry,
      vat_number: emptyToNull(parsed.data.vat_number),
      tax_id: emptyToNull(parsed.data.tax_id),
      legal_address,
    })
    .eq("id", parsed.data.client_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/clients/${parsed.data.client_id}`);

  return { ok: true, message: "Legal & compliance saved." };
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

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { error } = await supabase
    .from("clients")
    .update({
      currency: parsed.data.currency,
      payment_terms: (emptyToNull(parsed.data.payment_terms) ??
        null) as PaymentTerms | null,
      credit_limit: parsed.data.credit_limit ?? null,
      credit_limit_active: parsed.data.credit_limit_active,
      accept_credit_risk: parsed.data.accept_credit_risk,
      billing_email: emptyToNull(parsed.data.billing_email),
      billing_phone: emptyToNull(parsed.data.billing_phone),
    })
    .eq("id", parsed.data.client_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/finance/credit-limit");

  return { ok: true, message: "Finance settings saved." };
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

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { error } = await supabase
    .from("clients")
    .update({
      credit_limit: parsed.data.credit_limit ?? null,
      credit_limit_active: parsed.data.credit_limit_active,
      accept_credit_risk: parsed.data.accept_credit_risk,
    })
    .eq("id", parsed.data.client_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/finance/credit-limit");

  return { ok: true, message: "Credit limit saved." };
}

export async function uploadClientDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
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
      bucket: "client-documents",
      entityId: parsed.data.client_id,
      documentType: parsed.data.document_type,
      file,
    });

    const { error } = await supabase.from("client_documents").insert({
      client_id: parsed.data.client_id,
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
        bucket: "client-documents",
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

  revalidatePath(`/clients/${parsed.data.client_id}`);

  return { ok: true, message: "Document uploaded." };
}

export async function deleteClientDocumentAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const documentId = String(formData.get("document_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");

  if (!documentId || !clientId) {
    return { ok: false, message: "Missing document reference." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const { data: doc, error: fetchError } = await supabase
    .from("client_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (fetchError || !doc) {
    return { ok: false, message: fetchError?.message ?? "Document not found." };
  }

  const { error: deleteRowError } = await supabase
    .from("client_documents")
    .delete()
    .eq("id", documentId);

  if (deleteRowError) {
    return { ok: false, message: deleteRowError.message };
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

  return { ok: true, message: "Document removed." };
}

export async function getClientDocumentDownloadUrlAction(
  documentId: string,
  clientId: string
): Promise<{ url?: string; error?: string }> {
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

  if (error || !doc) {
    return { error: error?.message ?? "Document not found." };
  }

  try {
    const url = await createSignedDocumentUrl({
      supabase,
      bucket: "client-documents",
      storagePath: doc.storage_path,
    });
    return { url };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not create download link.",
    };
  }
}
