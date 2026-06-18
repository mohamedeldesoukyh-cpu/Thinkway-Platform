import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import {
  getMissingClientColumnFromSchemaError,
  isMissingClientColumnSchemaError,
  OPTIONAL_CLIENT_COLUMN_NAMES,
} from "@/lib/clients/classification-audit-columns";

const MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS = 16;

function stripColumn(columns: string[], column: string): string[] {
  return columns.filter((entry) => entry !== column);
}

function isOptionalClientColumn(column: string): boolean {
  return (OPTIONAL_CLIENT_COLUMN_NAMES as readonly string[]).includes(column);
}

export type ClientCreditLimitFlags = {
  credit_limit: number | null;
  credit_limit_active: boolean;
  accept_credit_risk: boolean;
  currency: string;
};

export type ClientCreditLimitListRow = {
  id: string;
  document_number: string;
  name: string;
  legal_name: string | null;
  currency: string;
  credit_limit: number | null;
  credit_limit_active: boolean;
  accept_credit_risk: boolean;
};

const CREDIT_LIMIT_FLAGS_CORE = ["id", "credit_limit", "currency"] as const;
const CREDIT_LIMIT_FLAGS_OPTIONAL = ["credit_limit_active", "accept_credit_risk"] as const;

const CREDIT_LIMIT_LIST_CORE = [
  "id",
  "document_number",
  "name",
  "legal_name",
  "currency",
  "credit_limit",
] as const;

const CREDIT_LIMIT_LIST_OPTIONAL = [
  "credit_limit_active",
  "accept_credit_risk",
] as const;

function normalizeCreditLimitFlags(
  row: Record<string, unknown>,
  strippedColumns: readonly string[]
): ClientCreditLimitFlags {
  const stripped = new Set(strippedColumns);

  return {
    credit_limit:
      row.credit_limit != null ? Number(row.credit_limit) : null,
    credit_limit_active: stripped.has("credit_limit_active")
      ? false
      : Boolean(row.credit_limit_active),
    accept_credit_risk: stripped.has("accept_credit_risk")
      ? false
      : Boolean(row.accept_credit_risk),
    currency: String(row.currency ?? "USD"),
  };
}

function normalizeCreditLimitListRow(
  row: Record<string, unknown>,
  strippedColumns: readonly string[]
): ClientCreditLimitListRow {
  const flags = normalizeCreditLimitFlags(row, strippedColumns);

  return {
    id: String(row.id),
    document_number: String(row.document_number),
    name: String(row.name),
    legal_name: (row.legal_name as string | null | undefined) ?? null,
    currency: flags.currency,
    credit_limit: flags.credit_limit,
    credit_limit_active: flags.credit_limit_active,
    accept_credit_risk: flags.accept_credit_risk,
  };
}

type ClientQueryResult = {
  data: Record<string, unknown> | null;
  error: PostgrestError | null;
};

type ClientListQueryResult = {
  data: Record<string, unknown>[] | null;
  error: PostgrestError | null;
};

async function queryClientRowWithColumnRetry(
  supabase: SupabaseClient,
  clientId: string,
  initialColumns: readonly string[]
): Promise<{
  data: Record<string, unknown> | null;
  error: PostgrestError | null;
  strippedColumns: string[];
}> {
  let columns = [...initialColumns];
  const strippedColumns: string[] = [];
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS; attempt += 1) {
    const result: ClientQueryResult = await supabase
      .from("clients")
      .select(columns.join(", "))
      .eq("id", clientId)
      .maybeSingle();

    if (!result.error) {
      return {
        data: result.data != null ? result.data : null,
        error: null,
        strippedColumns,
      };
    }

    lastError = result.error;

    if (!isMissingClientColumnSchemaError(result.error)) {
      return { data: null, error: result.error, strippedColumns };
    }

    const missingColumn = getMissingClientColumnFromSchemaError(result.error);
    if (
      missingColumn &&
      (columns.includes(missingColumn) || isOptionalClientColumn(missingColumn))
    ) {
      console.warn(
        `[clients] ${missingColumn} column missing while loading client ${clientId}; retrying without it:`,
        result.error.message
      );
      columns = stripColumn(columns, missingColumn);
      strippedColumns.push(missingColumn);
      continue;
    }

    return { data: null, error: result.error, strippedColumns };
  }

  return { data: null, error: lastError, strippedColumns };
}

async function queryClientRowsWithColumnRetry(
  supabase: SupabaseClient,
  initialColumns: readonly string[],
  runQuery: (
    select: string
  ) => PromiseLike<ClientListQueryResult>
): Promise<{
  data: Record<string, unknown>[] | null;
  error: PostgrestError | null;
  strippedColumns: string[];
}> {
  let columns = [...initialColumns];
  const strippedColumns: string[] = [];
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS; attempt += 1) {
    const result = await runQuery(columns.join(", "));

    if (!result.error) {
      return {
        data: result.data,
        error: null,
        strippedColumns,
      };
    }

    lastError = result.error;

    if (!isMissingClientColumnSchemaError(result.error)) {
      return { data: null, error: result.error, strippedColumns };
    }

    const missingColumn = getMissingClientColumnFromSchemaError(result.error);
    if (
      missingColumn &&
      (columns.includes(missingColumn) || isOptionalClientColumn(missingColumn))
    ) {
      console.warn(
        `[clients] ${missingColumn} column missing while loading clients; retrying without it:`,
        result.error.message
      );
      columns = stripColumn(columns, missingColumn);
      strippedColumns.push(missingColumn);
      continue;
    }

    return { data: null, error: result.error, strippedColumns };
  }

  return { data: null, error: lastError, strippedColumns };
}

/**
 * Load a client row by id, retrying without optional columns when production
 * schema lags behind migrations (PGRST204 / PostgreSQL 42703).
 */
export async function fetchClientRowSafe(
  supabase: SupabaseClient,
  clientId: string,
  columns: readonly string[]
): Promise<{
  row: Record<string, unknown> | null;
  error: PostgrestError | null;
  strippedColumns: string[];
}> {
  const result = await queryClientRowWithColumnRetry(supabase, clientId, columns);
  return {
    row: result.data,
    error: result.error,
    strippedColumns: result.strippedColumns,
  };
}

/**
 * Load client rows with optional column stripping when production schema lags.
 */
export async function fetchClientRowsSafe(
  supabase: SupabaseClient,
  columns: readonly string[],
  runQuery: (
    select: string
  ) => PromiseLike<ClientListQueryResult>
): Promise<{
  rows: Record<string, unknown>[];
  error: PostgrestError | null;
  strippedColumns: string[];
}> {
  const result = await queryClientRowsWithColumnRetry(supabase, columns, runQuery);
  return {
    rows: result.data ?? [],
    error: result.error,
    strippedColumns: result.strippedColumns,
  };
}

/** Safe read of credit-limit enforcement flags when columns may be absent. */
export async function fetchClientCreditLimitFlagsSafe(
  supabase: SupabaseClient,
  clientId: string
): Promise<
  | ({ found: true } & ClientCreditLimitFlags & { error: null })
  | ({ found: false } & ClientCreditLimitFlags & { error: string | null })
> {
  const result = await queryClientRowWithColumnRetry(supabase, clientId, [
    ...CREDIT_LIMIT_FLAGS_CORE,
    ...CREDIT_LIMIT_FLAGS_OPTIONAL,
  ]);

  if (result.error) {
    return {
      found: false,
      credit_limit: null,
      credit_limit_active: false,
      accept_credit_risk: false,
      currency: "USD",
      error: result.error.message,
    };
  }

  if (!result.data) {
    return {
      found: false,
      credit_limit: null,
      credit_limit_active: false,
      accept_credit_risk: false,
      currency: "USD",
      error: null,
    };
  }

  return {
    found: true,
    ...normalizeCreditLimitFlags(result.data, result.strippedColumns),
    error: null,
  };
}

/** Safe list of clients for the credit-limit workspace. */
export async function fetchClientCreditLimitListSafe(
  supabase: SupabaseClient
): Promise<{
  clients: ClientCreditLimitListRow[];
  error: PostgrestError | null;
}> {
  const result = await queryClientRowsWithColumnRetry(
    supabase,
    [...CREDIT_LIMIT_LIST_CORE, ...CREDIT_LIMIT_LIST_OPTIONAL],
    (select) =>
      supabase
        .from("clients")
        .select(select)
        .order("name", { ascending: true }) as unknown as PromiseLike<ClientListQueryResult>
  );

  if (result.error) {
    return { clients: [], error: result.error };
  }

  return {
    clients: (result.data ?? []).map((row) =>
      normalizeCreditLimitListRow(row, result.strippedColumns)
    ),
    error: null,
  };
}
