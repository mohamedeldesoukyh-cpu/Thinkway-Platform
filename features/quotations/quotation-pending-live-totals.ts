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

  return {
    ...item,
    ...(pending.deliverables !== undefined ? { deliverables: pending.deliverables } : {}),
    ...(pending.service_description !== undefined
      ? { service_description: pending.service_description }
      : {}),
    ...(pending.cost != null ? { cost: pending.cost } : {}),
    ...(pending.revenue != null ? { revenue: pending.revenue } : {}),
    ...(pending.gp_pct != null ? { gp_pct: pending.gp_pct } : {}),
    ...(pending.gp_value != null ? { gp_value: pending.gp_value } : {}),
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
    ...(pending.cost != null ? { cost: pending.cost } : {}),
    ...(pending.revenue != null ? { revenue: pending.revenue } : {}),
    ...(pending.gp_pct != null ? { gpPct: pending.gp_pct } : {}),
    ...(pending.gp_value != null ? { gpValue: pending.gp_value } : {}),
    ...(pending.af_pct != null ? { afPct: pending.af_pct } : {}),
    ...(pending.mode ? { mode: pending.mode } : {}),
  });
}
