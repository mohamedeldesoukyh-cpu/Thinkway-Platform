import type { CampaignLineWorkspace } from "@/features/campaigns/types";

type AssignmentCurrencyLine = Pick<
  CampaignLineWorkspace,
  "currency_code" | "cost_received_currency"
>;

/**
 * Commercial currency for an assignment line. Prefer saved line.currency_code;
 * never substitute campaign/header currency when line currency is set.
 */
export function resolveAssignmentLineCurrency(
  line: AssignmentCurrencyLine,
  options?: { fallback?: string | null }
): string {
  const code = line.currency_code?.trim();
  if (code) return code;

  const received = line.cost_received_currency?.trim();
  if (received) return received;

  const fallback = options?.fallback?.trim();
  return fallback || "USD";
}

/** CCY column — show em dash when no assignment currency is stored. */
export function resolveAssignmentLineCurrencyDisplay(
  line: AssignmentCurrencyLine
): string {
  const code = line.currency_code?.trim();
  if (code) return code;

  const received = line.cost_received_currency?.trim();
  if (received) return received;

  return "—";
}
