import { calculatePoConsumption, type PoHealth } from "./calculations";
import { computePoStatus, type PoStatus } from "./status";

export type OperationalPoSnapshot = {
  /** Approved PO budget in campaign currency (governance or legacy fallback). */
  po_amount: number;
  po_consumed: number;
  po_remaining: number;
  po_remaining_percent: number | null;
  po_status: PoStatus;
  health: PoHealth;
  po_exceeded: boolean;
  /** True when header po_amount_campaign_currency is set (> 0). */
  uses_governance: boolean;
};

export type ResolveOperationalPoInput = {
  po_amount_campaign_currency?: number | null;
  po_consumed_amount?: number | null;
  po_remaining_amount?: number | null;
  po_remaining_percent?: number | null;
  po_status?: PoStatus | null;
  po_expiry_date?: string | null;
  po_number?: string | null;
  /** Sum of line po_amount — legacy fallback when governance PO is unset. */
  legacy_budget: number;
  /** Sum of line billable base (Rev + UR + AF) — legacy consumption fallback. */
  legacy_consumed: number;
};

/**
 * Single operational PO source of truth.
 * Uses header governance fields when po_amount_campaign_currency is set (> 0);
 * otherwise falls back to legacy line aggregates for historical campaigns.
 * (Column is NOT NULL DEFAULT 0 in DB — zero means unset, not an approved PO.)
 */
export function resolveOperationalPo(
  input: ResolveOperationalPoInput
): OperationalPoSnapshot {
  const governanceAmount = input.po_amount_campaign_currency;
  const usesGovernance =
    governanceAmount != null && Number(governanceAmount) > 0;

  const poAmount = usesGovernance
    ? Number(governanceAmount)
    : input.legacy_budget;

  const poConsumed =
    usesGovernance && input.po_consumed_amount != null
      ? Number(input.po_consumed_amount)
      : input.legacy_consumed;

  const consumption = calculatePoConsumption({
    po_amount: poAmount,
    consumed: poConsumed,
  });

  const poRemaining =
    usesGovernance && input.po_remaining_amount != null
      ? Number(input.po_remaining_amount)
      : consumption.remaining;

  const poRemainingPercent =
    usesGovernance && input.po_remaining_percent != null
      ? Number(input.po_remaining_percent)
      : consumption.remaining_percent;

  const poStatus = computePoStatus({
    po_amount: poAmount,
    consumed: poConsumed,
    remaining_percent: poRemainingPercent,
    expiry_date: input.po_expiry_date ?? null,
    current_status: input.po_status ?? undefined,
  });

  const poExceeded = poAmount > 0 && poConsumed > poAmount;

  return {
    po_amount: poAmount,
    po_consumed: poConsumed,
    po_remaining: poRemaining,
    po_remaining_percent: poRemainingPercent,
    po_status: poExceeded ? "exceeded" : poStatus,
    health: poExceeded ? "exceeded" : consumption.health,
    po_exceeded: poExceeded,
    uses_governance: usesGovernance,
  };
}

/** Campaign workspace PO alert — consumption is billable base everywhere. */
export function resolveWorkspacePoAlert(input: {
  operational: OperationalPoSnapshot;
}): {
  po_exceeded: boolean;
  po_banner_consumed: number;
} {
  const { operational } = input;
  return {
    po_exceeded: operational.po_exceeded,
    po_banner_consumed: operational.po_consumed,
  };
}

export function resolveCampaignListPoBudget(campaign: {
  po_amount_campaign_currency?: number | null;
  lines: { po_amount?: number | null }[];
}): number {
  const legacyBudget = campaign.lines.reduce(
    (sum, line) => sum + Number(line.po_amount ?? 0),
    0
  );

  return resolveOperationalPo({
    po_amount_campaign_currency: campaign.po_amount_campaign_currency,
    legacy_budget: legacyBudget,
    legacy_consumed: 0,
  }).po_amount;
}
