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

/** Category columns that may still be legacy PostgreSQL enums on production. */
export const CLIENT_TAXONOMY_COLUMN_NAMES = [
  "client_category",
  "client_subcategory",
] as const;

/** Optional client columns that may be absent on production until migrations run. */
export const OPTIONAL_CLIENT_COLUMN_NAMES = [
  NAME_AR_COLUMN,
  ...CLIENT_TAXONOMY_COLUMN_NAMES,
  "vr_rate_id",
  "credit_limit_active",
  "accept_credit_risk",
  ...CLASSIFICATION_AUDIT_COLUMN_NAMES,
] as const;

const MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS = 16;

const PGRST204_MISSING_COLUMN_RE =
  /Could not find the '([^']+)' column of 'clients' in the schema cache/;

/** PostgreSQL 42703 — column may be referenced as clients.col or public.clients.col */
const PG_MISSING_CLIENT_COLUMN_RE =
  /column\s+(?:[\w.]+\.)?(\w+)\s+does not exist/i;

const INVALID_ENUM_VALUE_RE =
  /invalid input value for enum (?:\w+\.)?(\w+):/i;

function parseMissingClientColumnFromMessage(message: string): string | null {
  const pgrstMatch = message.match(PGRST204_MISSING_COLUMN_RE);
  if (pgrstMatch?.[1]) {
    return pgrstMatch[1];
  }

  if (message.includes("Could not find the '")) {
    const legacyMatch = message.match(/Could not find the '([^']+)' column/);
    if (legacyMatch?.[1]) {
      return legacyMatch[1];
    }
  }

  const pgMatch = message.match(PG_MISSING_CLIENT_COLUMN_RE);
  if (pgMatch?.[1] && message.toLowerCase().includes("clients")) {
    return pgMatch[1];
  }

  return null;
}

/** Parse the column name from a PostgreSQL invalid enum value error. */
export function getInvalidClientEnumColumnFromError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): string | null {
  if (!error?.message) {
    return null;
  }

  const match = error.message.match(INVALID_ENUM_VALUE_RE);
  if (!match?.[1]) {
    return null;
  }

  const column = match[1];
  if (!(CLIENT_TAXONOMY_COLUMN_NAMES as readonly string[]).includes(column)) {
    return null;
  }

  return column;
}

/** True when PostgreSQL rejects a taxonomy slug against a legacy enum column. */
export function isInvalidClientEnumValueError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  if (!error?.message) {
    return false;
  }

  if (getInvalidClientEnumColumnFromError(error)) {
    return true;
  }

  return (
    error.code === "22P02" &&
    error.message.toLowerCase().includes("invalid input value for enum")
  );
}

/** Parse the missing clients column name from a PostgREST PGRST204 schema-cache error. */
export function getMissingClientColumnFromSchemaError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): string | null {
  if (!error?.message) {
    return null;
  }

  const parsed = parseMissingClientColumnFromMessage(error.message);
  if (parsed) {
    return parsed;
  }

  if (error.code === "42703" || error.code === "PGRST204") {
    return parseMissingClientColumnFromMessage(error.message);
  }

  return null;
}

/** True when PostgREST reports a missing clients column in the schema cache. */
export function isMissingClientColumnSchemaError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  if (!error?.message) {
    return false;
  }

  if (getMissingClientColumnFromSchemaError(error)) {
    return true;
  }

  if (
    error.message.includes("schema cache") &&
    error.message.includes("clients")
  ) {
    return true;
  }

  if (error.code === "42703" && error.message.toLowerCase().includes("clients")) {
    return Boolean(parseMissingClientColumnFromMessage(error.message));
  }

  return false;
}

/** @deprecated Use isMissingClientColumnSchemaError */
export function isMissingNameArColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  const missingColumn = getMissingClientColumnFromSchemaError(error);
  if (missingColumn === NAME_AR_COLUMN) {
    return true;
  }

  return Boolean(
    error?.message?.includes("schema cache") &&
      error.message.includes(NAME_AR_COLUMN)
  );
}

/** @deprecated Use isMissingClientColumnSchemaError */
export function isMissingClassificationAuditColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  const missingColumn = getMissingClientColumnFromSchemaError(error);
  if (missingColumn) {
    return (CLASSIFICATION_AUDIT_COLUMN_NAMES as readonly string[]).includes(
      missingColumn
    );
  }

  const message = error?.message ?? "";
  if (message.includes("schema cache") && message.includes("clients")) {
    return CLASSIFICATION_AUDIT_COLUMN_NAMES.some((column) =>
      message.includes(column)
    );
  }

  return CLASSIFICATION_AUDIT_COLUMN_NAMES.some((column) => message.includes(column));
}

export function stripClientPayloadColumn(
  payload: Record<string, unknown>,
  column: string
): Record<string, unknown> {
  if (!(column in payload)) {
    return payload;
  }

  const { [column]: _removed, ...rest } = payload;
  return rest;
}

function stripRetryableClientColumnFromPayload(
  payload: Record<string, unknown>,
  error: Pick<PostgrestError, "message" | "code">
): { payload: Record<string, unknown>; strippedColumn: string | null } {
  const missingColumn = getMissingClientColumnFromSchemaError(error);
  if (missingColumn && missingColumn in payload) {
    console.warn(
      `[clients] ${missingColumn} column missing; retrying without it:`,
      error.message
    );

    return {
      payload: stripClientPayloadColumn(payload, missingColumn),
      strippedColumn: missingColumn,
    };
  }

  const invalidEnumColumn = getInvalidClientEnumColumnFromError(error);
  if (invalidEnumColumn && invalidEnumColumn in payload) {
    console.warn(
      `[clients] ${invalidEnumColumn} legacy enum mismatch; retrying without taxonomy columns:`,
      error.message
    );

    let nextPayload = stripClientPayloadColumn(payload, invalidEnumColumn);
    for (const column of CLIENT_TAXONOMY_COLUMN_NAMES) {
      if (column !== invalidEnumColumn && column in nextPayload) {
        nextPayload = stripClientPayloadColumn(nextPayload, column);
      }
    }

    return {
      payload: nextPayload,
      strippedColumn: invalidEnumColumn,
    };
  }

  if (
    isInvalidClientEnumValueError(error) &&
    CLIENT_TAXONOMY_COLUMN_NAMES.some((column) => column in payload)
  ) {
    console.warn(
      "[clients] legacy client_category enum mismatch; retrying without taxonomy columns:",
      error.message
    );

    let nextPayload = payload;
    for (const column of CLIENT_TAXONOMY_COLUMN_NAMES) {
      if (column in nextPayload) {
        nextPayload = stripClientPayloadColumn(nextPayload, column);
      }
    }

    return {
      payload: nextPayload,
      strippedColumn: "client_category",
    };
  }

  return { payload, strippedColumn: null };
}

function wasClassificationAuditStripped(strippedColumns: readonly string[]): boolean {
  return strippedColumns.some((column) =>
    (CLASSIFICATION_AUDIT_COLUMN_NAMES as readonly string[]).includes(column)
  );
}

async function runClientInsertWithOptionalColumnRetry(
  supabase: SupabaseClient,
  initialPayload: Record<string, unknown>
): Promise<{
  data: { id: string } | null;
  error: PostgrestError | null;
  strippedColumns: string[];
}> {
  let payload = initialPayload;
  const strippedColumns: string[] = [];
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS; attempt += 1) {
    const result = await supabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();

    if (!result.error) {
      return { data: result.data, error: null, strippedColumns };
    }

    lastError = result.error;

    if (
      !isMissingClientColumnSchemaError(result.error) &&
      !isInvalidClientEnumValueError(result.error)
    ) {
      return { data: null, error: result.error, strippedColumns };
    }

    const stripped = stripRetryableClientColumnFromPayload(payload, result.error);
    if (!stripped.strippedColumn) {
      return { data: null, error: result.error, strippedColumns };
    }

    payload = stripped.payload;
    strippedColumns.push(stripped.strippedColumn);
  }

  return { data: null, error: lastError, strippedColumns };
}

export async function updateClientWithOptionalColumnRetry(
  supabase: SupabaseClient,
  clientId: string,
  initialPayload: Record<string, unknown>,
  options?: { eq?: Record<string, unknown> }
): Promise<{
  error: PostgrestError | null;
  strippedColumns: string[];
}> {
  let payload = initialPayload;
  const strippedColumns: string[] = [];
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS; attempt += 1) {
    let query = supabase.from("clients").update(payload).eq("id", clientId);

    if (options?.eq) {
      for (const [column, value] of Object.entries(options.eq)) {
        query = query.eq(column, value);
      }
    }

    const result = await query;

    if (!result.error) {
      return { error: null, strippedColumns };
    }

    lastError = result.error;

    if (
      !isMissingClientColumnSchemaError(result.error) &&
      !isInvalidClientEnumValueError(result.error)
    ) {
      return { error: result.error, strippedColumns };
    }

    const stripped = stripRetryableClientColumnFromPayload(payload, result.error);
    if (!stripped.strippedColumn) {
      return { error: result.error, strippedColumns };
    }

    payload = stripped.payload;
    strippedColumns.push(stripped.strippedColumn);
  }

  return { error: lastError, strippedColumns };
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
  const result = await runClientInsertWithOptionalColumnRetry(supabase, {
    ...corePayload,
    ...audit,
  });

  return {
    data: result.data,
    error: result.error,
    auditSkipped: wasClassificationAuditStripped(result.strippedColumns),
    nameArSkipped: result.strippedColumns.includes(NAME_AR_COLUMN),
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
  const result = await updateClientWithOptionalColumnRetry(supabase, clientId, {
    ...corePayload,
    ...audit,
  });

  return {
    error: result.error,
    auditSkipped: wasClassificationAuditStripped(result.strippedColumns),
    nameArSkipped: result.strippedColumns.includes(NAME_AR_COLUMN),
  };
}
