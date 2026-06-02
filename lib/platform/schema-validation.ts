import { devLog } from "@/lib/platform/logger";

/**
 * Known schema registry (application-level). Extend when migrations add tables/columns.
 * Used for safeSelect fallbacks — not a live DB introspection.
 */
export const KNOWN_TABLES = new Set([
  "clients",
  "brands",
  "campaign_headers",
  "campaign_lines",
  "invoices",
  "invoice_line_items",
  "budget_versions",
  "budget_lines",
  "forecast_versions",
  "campaign_influencers",
  "profiles",
  "permissions",
]);

export const KNOWN_COLUMNS: Record<string, Set<string>> = {
  clients: new Set([
    "id",
    "name",
    "country",
    "country_code",
    "country_name",
    "billing_country",
    "currency",
    "account_manager_id",
  ]),
  brands: new Set(["id", "name", "country_code", "country", "client_id"]),
  campaign_headers: new Set([
    "id",
    "name",
    "client_id",
    "brand_id",
    "currency_code",
    "start_date",
    "team_id",
    "status",
  ]),
  invoices: new Set([
    "id",
    "total",
    "amount_paid",
    "status",
    "campaign_header_id",
    "issue_date",
  ]),
};

export function hasTable(table: string): boolean {
  return KNOWN_TABLES.has(table);
}

export function hasColumn(table: string, column: string): boolean {
  const cols = KNOWN_COLUMNS[table];
  if (!cols) return false;
  return cols.has(column);
}

export function isMissingColumnError(message: string): boolean {
  return (
    message.includes("does not exist") ||
    message.includes("Could not find") ||
    /column\s+[\w.]+\s+does not exist/i.test(message) ||
    /Could not find the '\w+' column/i.test(message)
  );
}

export function isMissingTableError(message: string): boolean {
  return (
    message.includes("relation") && message.includes("does not exist") ||
    /Could not find the table/i.test(message)
  );
}

export function isRelationshipError(message: string): boolean {
  return (
    message.includes("relationship") ||
    message.includes("embed") ||
    message.includes("foreign key") ||
    /PGRST200/i.test(message)
  );
}

export function isRlsError(message: string): boolean {
  return (
    message.includes("row-level security") ||
    message.includes("violates row-level security") ||
    message.includes("permission denied") ||
    /42501/.test(message)
  );
}

export function classifyQueryError(message: string): "schema" | "rls" | "relationship" | "unknown" {
  if (isMissingColumnError(message) || isMissingTableError(message)) return "schema";
  if (isRlsError(message)) return "rls";
  if (isRelationshipError(message)) return "relationship";
  return "unknown";
}

export type SafeSelectCandidate = {
  select: string;
  label: string;
};

/**
 * Tries Supabase selects in order until one succeeds or all fail.
 */
export async function safeSelect<T>(
  label: string,
  candidates: SafeSelectCandidate[],
  run: (select: string) => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<{ data: T; selectUsed: string }> {
  let lastError: string | null = null;

  for (const candidate of candidates) {
    const result = await run(candidate.select);
    if (!result.error) {
      if (lastError) {
        devLog("schema-validation", `${label} recovered`, {
          select: candidate.label,
          previousError: lastError,
        });
      }
      return { data: (result.data ?? []) as T, selectUsed: candidate.label };
    }

    lastError = result.error.message;
    if (!isMissingColumnError(lastError) && !isRelationshipError(lastError)) {
      throw new Error(lastError);
    }

    devLog("schema-validation", `${label} select fallback`, {
      failed: candidate.label,
      error: lastError,
    });
  }

  throw new Error(lastError ?? `${label}: all select candidates failed`);
}
