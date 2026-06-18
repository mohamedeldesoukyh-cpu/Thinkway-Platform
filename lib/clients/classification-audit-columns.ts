import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { ClassificationAuditPayload } from "@/lib/clients/build-classification-audit";

export const CLASSIFICATION_AUDIT_COLUMN_NAMES = [
  "classification_source",
  "classification_confidence",
  "classification_reason",
  "classified_at",
  "approved_by_user",
  "last_verified_at",
  "needs_review",
] as const;

/** PostgREST / schema-cache errors when classification audit columns are not migrated yet. */
export function isMissingClassificationAuditColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  if (!error?.message) {
    return false;
  }

  if (error.code === "PGRST204") {
    return true;
  }

  const message = error.message;
  if (message.includes("schema cache") && message.includes("clients")) {
    return true;
  }

  return CLASSIFICATION_AUDIT_COLUMN_NAMES.some((column) => message.includes(column));
}

export async function insertClientWithClassificationAudit(
  supabase: SupabaseClient,
  corePayload: Record<string, unknown>,
  audit: ClassificationAuditPayload
): Promise<{
  data: { id: string } | null;
  error: PostgrestError | null;
  auditSkipped: boolean;
}> {
  const fullPayload = { ...corePayload, ...audit };
  const primary = await supabase
    .from("clients")
    .insert(fullPayload)
    .select("id")
    .single();

  if (!primary.error) {
    return { data: primary.data, error: null, auditSkipped: false };
  }

  if (!isMissingClassificationAuditColumnError(primary.error)) {
    return { data: null, error: primary.error, auditSkipped: false };
  }

  console.warn(
    "[clients] classification audit columns missing; saving new client without audit fields:",
    primary.error.message
  );

  const fallback = await supabase
    .from("clients")
    .insert(corePayload)
    .select("id")
    .single();

  return {
    data: fallback.data,
    error: fallback.error,
    auditSkipped: true,
  };
}

export async function updateClientWithClassificationAudit(
  supabase: SupabaseClient,
  clientId: string,
  corePayload: Record<string, unknown>,
  audit: ClassificationAuditPayload
): Promise<{ error: PostgrestError | null; auditSkipped: boolean }> {
  const fullPayload = { ...corePayload, ...audit };
  const primary = await supabase.from("clients").update(fullPayload).eq("id", clientId);

  if (!primary.error) {
    return { error: null, auditSkipped: false };
  }

  if (!isMissingClassificationAuditColumnError(primary.error)) {
    return { error: primary.error, auditSkipped: false };
  }

  console.warn(
    "[clients] classification audit columns missing; saving client without audit fields:",
    primary.error.message
  );

  const fallback = await supabase.from("clients").update(corePayload).eq("id", clientId);

  return {
    error: fallback.error,
    auditSkipped: true,
  };
}
