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

export const NAME_AR_COLUMN = "name_ar" as const;

function getMissingColumnFromPgrst204Error(
  error: Pick<PostgrestError, "message" | "code">
): string | null {
  if (error.code !== "PGRST204" || !error.message) {
    return null;
  }

  const match = error.message.match(/Could not find the '([^']+)' column/);
  return match?.[1] ?? null;
}

/** PostgREST / schema-cache errors when name_ar is not migrated yet. */
export function isMissingNameArColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  if (!error?.message) {
    return false;
  }

  const missingColumn = getMissingColumnFromPgrst204Error(error);
  if (missingColumn === NAME_AR_COLUMN) {
    return true;
  }

  return (
    error.message.includes("schema cache") &&
    error.message.includes(NAME_AR_COLUMN)
  );
}

/** PostgREST / schema-cache errors when classification audit columns are not migrated yet. */
export function isMissingClassificationAuditColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  if (!error?.message) {
    return false;
  }

  if (isMissingNameArColumnError(error)) {
    return false;
  }

  const missingColumn = getMissingColumnFromPgrst204Error(error);
  if (missingColumn) {
    return (CLASSIFICATION_AUDIT_COLUMN_NAMES as readonly string[]).includes(
      missingColumn
    );
  }

  const message = error.message;
  if (message.includes("schema cache") && message.includes("clients")) {
    return CLASSIFICATION_AUDIT_COLUMN_NAMES.some((column) =>
      message.includes(column)
    );
  }

  return CLASSIFICATION_AUDIT_COLUMN_NAMES.some((column) => message.includes(column));
}

function isMissingOptionalClientColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  return (
    isMissingNameArColumnError(error) ||
    isMissingClassificationAuditColumnError(error)
  );
}

function stripClassificationAuditFields(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...payload };
  for (const column of CLASSIFICATION_AUDIT_COLUMN_NAMES) {
    delete next[column];
  }
  return next;
}

function stripOptionalClientColumns(
  payload: Record<string, unknown>,
  error: Pick<PostgrestError, "message" | "code">
): {
  payload: Record<string, unknown>;
  auditSkipped: boolean;
  nameArSkipped: boolean;
} {
  let next = payload;
  let auditSkipped = false;
  let nameArSkipped = false;

  if (NAME_AR_COLUMN in next && isMissingNameArColumnError(error)) {
    const { [NAME_AR_COLUMN]: _removed, ...rest } = next;
    next = rest;
    nameArSkipped = true;
    console.warn(
      "[clients] name_ar column missing; saving client without Arabic name:",
      error.message
    );
  }

  if (isMissingClassificationAuditColumnError(error)) {
    next = stripClassificationAuditFields(next);
    auditSkipped = true;
    console.warn(
      "[clients] classification audit columns missing; saving client without audit fields:",
      error.message
    );
  }

  return { payload: next, auditSkipped, nameArSkipped };
}

export async function insertClientWithClassificationAudit(
  supabase: SupabaseClient,
  corePayload: Record<string, unknown>,
  audit: ClassificationAuditPayload
): Promise<{
  data: { id: string } | null;
  error: PostgrestError | null;
  auditSkipped: boolean;
  nameArSkipped: boolean;
}> {
  let payload: Record<string, unknown> = { ...corePayload, ...audit };
  let auditSkipped = false;
  let nameArSkipped = false;
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await supabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();

    if (!result.error) {
      return {
        data: result.data,
        error: null,
        auditSkipped,
        nameArSkipped,
      };
    }

    lastError = result.error;

    if (!isMissingOptionalClientColumnError(result.error)) {
      return { data: null, error: result.error, auditSkipped, nameArSkipped };
    }

    const stripped = stripOptionalClientColumns(payload, result.error);
    if (
      stripped.payload === payload ||
      (!stripped.auditSkipped && !stripped.nameArSkipped)
    ) {
      return { data: null, error: result.error, auditSkipped, nameArSkipped };
    }

    payload = stripped.payload;
    auditSkipped = auditSkipped || stripped.auditSkipped;
    nameArSkipped = nameArSkipped || stripped.nameArSkipped;
  }

  return {
    data: null,
    error: lastError,
    auditSkipped,
    nameArSkipped,
  };
}

export async function updateClientWithClassificationAudit(
  supabase: SupabaseClient,
  clientId: string,
  corePayload: Record<string, unknown>,
  audit: ClassificationAuditPayload
): Promise<{
  error: PostgrestError | null;
  auditSkipped: boolean;
  nameArSkipped: boolean;
}> {
  let payload: Record<string, unknown> = { ...corePayload, ...audit };
  let auditSkipped = false;
  let nameArSkipped = false;
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await supabase.from("clients").update(payload).eq("id", clientId);

    if (!result.error) {
      return { error: null, auditSkipped, nameArSkipped };
    }

    lastError = result.error;

    if (!isMissingOptionalClientColumnError(result.error)) {
      return { error: result.error, auditSkipped, nameArSkipped };
    }

    const stripped = stripOptionalClientColumns(payload, result.error);
    if (
      stripped.payload === payload ||
      (!stripped.auditSkipped && !stripped.nameArSkipped)
    ) {
      return { error: result.error, auditSkipped, nameArSkipped };
    }

    payload = stripped.payload;
    auditSkipped = auditSkipped || stripped.auditSkipped;
    nameArSkipped = nameArSkipped || stripped.nameArSkipped;
  }

  return {
    error: lastError,
    auditSkipped,
    nameArSkipped,
  };
}
