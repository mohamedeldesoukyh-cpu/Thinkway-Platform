/**
 * Merge unsaved line pending payloads into quotation items/drafts so the
 * commercial metrics band stays live before Save.
 */
import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationItemRow } from "@/features/quotations/types";
import {
  resolveQuotationRowDraft,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";

export function applyPendingToQuotationItem(
  item: QuotationItemRow,
  pending?: QuotationLinePendingPayload
): QuotationItemRow {
  if (!pending) return item;

  const pendingDeliverables =
    pending.deliverables !== undefined && pending.deliverables.length > 0
      ? pending.deliverables
      : undefined;

  return {
    ...item,
    ...(pendingDeliverables ? { deliverables: pendingDeliverables } : {}),
    ...(pending.service_description !== undefined
      ? { service_description: pending.service_description }
      : {}),
    ...(pending.cost != null && pending.cost > 0 ? { cost: pending.cost } : {}),
    ...(pending.revenue != null && pending.revenue > 0 ? { revenue: pending.revenue } : {}),
    ...(pending.gp_pct != null ? { gp_pct: pending.gp_pct } : {}),
    ...(pending.gp_value != null && pending.gp_value > 0
      ? { gp_value: pending.gp_value }
      : {}),
    ...(pending.af_pct != null ? { af_pct: pending.af_pct } : {}),
    ...(pending.platform !== undefined ? { platform: pending.platform } : {}),
    ...(pending.handle !== undefined ? { handle: pending.handle } : {}),
    ...(pending.followers !== undefined ? { followers: pending.followers } : {}),
    ...(pending.engagement_rate !== undefined
      ? { engagement_rate: pending.engagement_rate }
      : {}),
    ...(pending.option_number !== undefined
      ? { option_number: pending.option_number }
      : {}),
    ...(pending.mode
      ? { commercial_input_mode: pending.mode }
      : {}),
  };
}

function positiveOrKeep(pendingValue: number | null | undefined, current: number): number {
  if (pendingValue == null || !Number.isFinite(pendingValue)) return current;
  // Never let an empty pending rollup wipe a live draft that already has amounts.
  if (pendingValue <= 0 && current > 0) return current;
  return pendingValue;
}

export function resolveLiveTotalsDraft(
  item: QuotationItemRow,
  draft: QuotationRowDraft | undefined,
  pending?: QuotationLinePendingPayload
): QuotationRowDraft {
  const mergedItem = applyPendingToQuotationItem(item, pending);
  const base = resolveQuotationRowDraft(mergedItem, draft);
  if (!pending) return base;

  return resolveQuotationRowDraft(mergedItem, {
    ...base,
    cost: positiveOrKeep(pending.cost, base.cost),
    revenue: positiveOrKeep(pending.revenue, base.revenue),
    gpPct: pending.gp_pct != null ? pending.gp_pct : base.gpPct,
    gpValue: positiveOrKeep(pending.gp_value, base.gpValue),
    afPct: pending.af_pct != null ? pending.af_pct : base.afPct,
    ...(pending.mode ? { mode: pending.mode } : {}),
  });
}
