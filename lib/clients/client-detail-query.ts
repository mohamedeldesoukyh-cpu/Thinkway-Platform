import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import {
  CLASSIFICATION_AUDIT_COLUMN_NAMES,
  CLIENT_TAXONOMY_COLUMN_NAMES,
  getMissingClientColumnFromSchemaError,
  isMissingClientColumnSchemaError,
  NAME_AR_COLUMN,
  OPTIONAL_CLIENT_COLUMN_NAMES,
} from "@/lib/clients/classification-audit-columns";
import { resolveClientTaxonomyFromRow } from "@/lib/clients/client-taxonomy-resolve";

const MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS = 16;
import type { ClientDetail, ClientRow } from "@/types/database";

const GROUP_REL_FULL = "group:groups(id, name, document_number)";
const GROUP_REL_CORE = "group:groups(id, name)";

/** Stable client columns expected on all deployed environments. */
export const CLIENT_DETAIL_SELECT_BASE = [
  "id",
  "document_number",
  "group_id",
  "name",
  "legal_name",
  "name_normalized",
  "industry",
  "website",
  "logo_url",
  "status",
  "billing_email",
  "billing_phone",
  "billing_address",
  "tax_id",
  "trade_license_number",
  "trade_license_expiry",
  "vat_number",
  "legal_address",
  "country",
  "city",
  "payment_terms",
  "credit_limit",
  "currency",
  "agency_or_direct",
  "account_manager_id",
  "notes",
  "client_io_terms_text",
  "metadata",
  "created_by",
  "created_at",
  "updated_at",
] as const;

/** Columns that may be absent until migrations run on production. */
export const CLIENT_DETAIL_SELECT_OPTIONAL = [
  NAME_AR_COLUMN,
  ...CLIENT_TAXONOMY_COLUMN_NAMES,
  "vr_rate_id",
  "credit_limit_active",
  "accept_credit_risk",
  "client_owner_id",
  "country_manager_id",
  "onboarding_status",
  "legal_completed_at",
  "finance_completed_at",
  "contracts_completed_at",
  "tax_completed_at",
  "onboarding_updated_by",
  "onboarding_completed_by",
  "activated_at",
  ...CLASSIFICATION_AUDIT_COLUMN_NAMES,
  "client_workspace_enabled",
  "client_workspace_package",
  "client_workspace_tab_overrides",
  "client_workspace_grandfathered",
  "client_workspace_preview_started_at",
  "client_workspace_preview_expires_at",
  "client_workspace_preview_previous_package",
] as const;

type ClientDetailRow = ClientRow & {
  group: ClientDetail["group"];
};

type ClientDetailQueryResult = {
  data: ClientDetailRow | null;
  error: PostgrestError | null;
};

function buildClientSelect(columns: readonly string[], groupRel: string): string {
  return `${columns.join(", ")}, ${groupRel}`;
}

function stripColumn(columns: string[], column: string): string[] {
  return columns.filter((entry) => entry !== column);
}

function isMissingGroupColumnError(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined
): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("groups") &&
    (message.includes("document_number") || message.includes("schema cache"))
  );
}

function normalizeClientDetailRow(
  row: Record<string, unknown>,
  strippedColumns: readonly string[]
): ClientDetailRow {
  const stripped = new Set(strippedColumns);
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : ((row.metadata as Record<string, unknown> | null | undefined) ?? {});
  const taxonomy = resolveClientTaxonomyFromRow({
    client_category: stripped.has("client_category")
      ? null
      : ((row.client_category as string | null | undefined) ?? null),
    client_subcategory: stripped.has("client_subcategory")
      ? null
      : ((row.client_subcategory as string | null | undefined) ?? null),
    metadata,
  });

  return {
    ...(row as unknown as ClientRow),
    name_ar: stripped.has(NAME_AR_COLUMN)
      ? null
      : ((row.name_ar as string | null | undefined) ?? null),
    client_category: taxonomy.client_category,
    client_subcategory: taxonomy.client_subcategory,
    vr_rate_id: stripped.has("vr_rate_id")
      ? null
      : ((row.vr_rate_id as string | null | undefined) ?? null),
    credit_limit_active: stripped.has("credit_limit_active")
      ? false
      : Boolean(row.credit_limit_active),
    accept_credit_risk: stripped.has("accept_credit_risk")
      ? false
      : Boolean(row.accept_credit_risk),
    classification_source: stripped.has("classification_source")
      ? null
      : ((row.classification_source as string | null | undefined) ?? null),
    classification_confidence: stripped.has("classification_confidence")
      ? null
      : ((row.classification_confidence as number | null | undefined) ?? null),
    classification_reason: stripped.has("classification_reason")
      ? null
      : ((row.classification_reason as string | null | undefined) ?? null),
    classified_at: stripped.has("classified_at")
      ? null
      : ((row.classified_at as string | null | undefined) ?? null),
    approved_by_user: stripped.has("approved_by_user")
      ? null
      : ((row.approved_by_user as string | null | undefined) ?? null),
    last_verified_at: stripped.has("last_verified_at")
      ? null
      : ((row.last_verified_at as string | null | undefined) ?? null),
    needs_review: stripped.has("needs_review")
      ? false
      : Boolean(row.needs_review),
    onboarding_status: stripped.has("onboarding_status")
      ? "legal_pending"
      : ((row.onboarding_status as ClientRow["onboarding_status"]) ?? "legal_pending"),
    legal_completed_at: stripped.has("legal_completed_at")
      ? null
      : ((row.legal_completed_at as string | null | undefined) ?? null),
    finance_completed_at: stripped.has("finance_completed_at")
      ? null
      : ((row.finance_completed_at as string | null | undefined) ?? null),
    contracts_completed_at: stripped.has("contracts_completed_at")
      ? null
      : ((row.contracts_completed_at as string | null | undefined) ?? null),
    tax_completed_at: stripped.has("tax_completed_at")
      ? null
      : ((row.tax_completed_at as string | null | undefined) ?? null),
    onboarding_updated_by: stripped.has("onboarding_updated_by")
      ? null
      : ((row.onboarding_updated_by as string | null | undefined) ?? null),
    onboarding_completed_by: stripped.has("onboarding_completed_by")
      ? null
      : ((row.onboarding_completed_by as string | null | undefined) ?? null),
    activated_at: stripped.has("activated_at")
      ? null
      : ((row.activated_at as string | null | undefined) ?? null),
    group: (row.group as ClientDetail["group"]) ?? null,
  };
}

async function queryClientDetailRow(
  supabase: SupabaseClient,
  id: string,
  columns: string[],
  groupRel: string
): Promise<ClientDetailQueryResult> {
  const result = await supabase
    .from("clients")
    .select(buildClientSelect(columns, groupRel))
    .eq("id", id)
    .maybeSingle();

  return {
    data: (result.data as Record<string, unknown> | null)?.id
      ? (result.data as unknown as ClientDetailRow)
      : null,
    error: result.error,
  };
}

/**
 * Load a client row for the profile page, retrying without optional columns when
 * PostgREST reports schema-cache / missing-column errors on production.
 */
export async function fetchClientDetailRowById(
  supabase: SupabaseClient,
  id: string
): Promise<{ client: ClientDetailRow | null; error: PostgrestError | null }> {
  let columns: string[] = [
    ...CLIENT_DETAIL_SELECT_BASE,
    ...CLIENT_DETAIL_SELECT_OPTIONAL,
  ];
  let groupRel = GROUP_REL_FULL;
  const strippedColumns: string[] = [];
  let lastError: PostgrestError | null = null;

  for (let attempt = 0; attempt < MAX_OPTIONAL_COLUMN_RETRY_ATTEMPTS; attempt += 1) {
    const result = await queryClientDetailRow(supabase, id, columns, groupRel);

    if (!result.error) {
      if (!result.data) {
        return { client: null, error: null };
      }

      return {
        client: normalizeClientDetailRow(
          result.data as unknown as Record<string, unknown>,
          strippedColumns
        ),
        error: null,
      };
    }

    lastError = result.error;

    if (isMissingGroupColumnError(result.error) && groupRel === GROUP_REL_FULL) {
      groupRel = GROUP_REL_CORE;
      continue;
    }

    if (!isMissingClientColumnSchemaError(result.error)) {
      return { client: null, error: result.error };
    }

    const missingColumn = getMissingClientColumnFromSchemaError(result.error);
    if (
      missingColumn &&
      (columns.includes(missingColumn) ||
        (OPTIONAL_CLIENT_COLUMN_NAMES as readonly string[]).includes(missingColumn))
    ) {
      console.warn(
        `[clients] ${missingColumn} column missing while loading client ${id}; retrying without it:`,
        result.error.message
      );
      columns = stripColumn(columns, missingColumn);
      strippedColumns.push(missingColumn);
      continue;
    }

    return { client: null, error: result.error };
  }

  return { client: null, error: lastError };
}
