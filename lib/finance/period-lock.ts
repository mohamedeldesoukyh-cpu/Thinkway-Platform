import type { SupabaseClient } from "@supabase/supabase-js";

export type FinancialPeriodStatus = "open" | "soft_locked" | "fully_locked";

export function isFinancialPeriodLocked(status: FinancialPeriodStatus): boolean {
  return status !== "open";
}

export function periodLockBlockReason(input: {
  year: number;
  month: number;
  status: FinancialPeriodStatus;
}): string {
  const label = `${input.year}-${String(input.month).padStart(2, "0")}`;
  if (input.status === "fully_locked") {
    return `Campaign cannot be cancelled — accounting period ${label} is fully locked.`;
  }
  if (input.status === "soft_locked") {
    return `Campaign cannot be cancelled — accounting period ${label} is soft locked.`;
  }
  return `Campaign cannot be cancelled — accounting period ${label} is locked.`;
}

export function resolveDateParts(date: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})/.exec(date.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export async function resolveFinancialPeriodLockForDate(
  supabase: SupabaseClient,
  date: string
): Promise<{
  year: number;
  month: number;
  status: FinancialPeriodStatus;
} | null> {
  const parts = resolveDateParts(date);
  if (!parts) return null;

  const { data, error } = await supabase
    .from("financial_periods")
    .select("status")
    .eq("year", parts.year)
    .eq("month", parts.month)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const status = (data as { status?: FinancialPeriodStatus } | null)?.status ?? "open";
  return { year: parts.year, month: parts.month, status };
}
