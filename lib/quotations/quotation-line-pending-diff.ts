import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";

function numOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function strOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeDeliverablesForCompare(
  deliverables: QuotationDeliverable[]
): string {
  const normalized = deliverables.map((d) => ({
    platform: d.platform?.trim() || "",
    type: d.type?.trim() || "",
    types: d.types?.length ? [...d.types] : undefined,
    type_lines: d.type_lines?.length
      ? d.type_lines.map((line) => ({
          type: line.type?.trim() || "",
          quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
        }))
      : undefined,
    quantity: Math.max(1, Math.floor(Number(d.quantity) || 1)),
    revenue: numOrNull(d.revenue),
    free_for_client: d.free_for_client === true,
    service_description: strOrNull(d.service_description),
    commercial_input_mode: d.commercial_input_mode ?? null,
    cost: numOrNull(d.cost),
    cost_currency: d.cost_currency ?? null,
    gp_pct: numOrNull(d.gp_pct),
    gp_value: numOrNull(d.gp_value),
    af_pct: numOrNull(d.af_pct),
  }));
  return JSON.stringify(normalized);
}

export function deliverableSnapshot(deliverable: QuotationDeliverable): string {
  return normalizeDeliverablesForCompare([deliverable]);
}

export function linePendingDiffersFromItem(
  item: QuotationItemRow,
  payload: QuotationLinePendingPayload
): boolean {
  if (
    payload.service_description !== undefined &&
    strOrNull(payload.service_description) !== strOrNull(item.service_description)
  ) {
    return true;
  }
  if (
    payload.option_number !== undefined &&
    (payload.option_number ?? null) !== (item.option_number ?? null)
  ) {
    return true;
  }
  if (payload.platform !== undefined && (payload.platform ?? null) !== (item.platform ?? null)) {
    return true;
  }
  if (payload.handle !== undefined && (payload.handle ?? null) !== (item.handle ?? null)) {
    return true;
  }
  if (
    payload.followers !== undefined &&
    numOrNull(payload.followers) !== numOrNull(item.followers)
  ) {
    return true;
  }
  if (
    payload.engagement_rate !== undefined &&
    numOrNull(payload.engagement_rate) !== numOrNull(item.engagement_rate)
  ) {
    return true;
  }
  if (payload.deliverables !== undefined) {
    return (
      normalizeDeliverablesForCompare(payload.deliverables) !==
      normalizeDeliverablesForCompare(item.deliverables ?? [])
    );
  }
  if (payload.cost !== undefined && numOrNull(payload.cost) !== numOrNull(item.cost)) {
    return true;
  }
  if (payload.revenue !== undefined && numOrNull(payload.revenue) !== numOrNull(item.revenue)) {
    return true;
  }
  if (payload.gp_pct !== undefined && numOrNull(payload.gp_pct) !== numOrNull(item.gp_pct)) {
    return true;
  }
  if (
    payload.gp_value !== undefined &&
    numOrNull(payload.gp_value) !== numOrNull(item.gp_value)
  ) {
    return true;
  }
  if (payload.af_pct !== undefined && numOrNull(payload.af_pct) !== numOrNull(item.af_pct)) {
    return true;
  }
  if (
    payload.mode !== undefined &&
    payload.mode !== item.commercial_input_mode
  ) {
    return true;
  }
  if (
    payload.cost_currency !== undefined &&
    (payload.cost_currency || "").toUpperCase() !==
      (item.cost_currency || "").toUpperCase()
  ) {
    return true;
  }
  return false;
}
