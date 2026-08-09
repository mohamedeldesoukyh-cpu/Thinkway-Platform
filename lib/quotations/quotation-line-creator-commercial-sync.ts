/**
 * Keep Commercial Workspace (line Master) and creator-line Cost Detail / Price
 * visually and pending-state aligned.
 *
 * Master remains SSOT. When Master is edited, deliverable commercials are
 * projected onto the first pricing row (others cleared) so Price + Cost Detail
 * show the same numbers. When Cost Detail rolls up, Master draft is updated by
 * the existing deliverable rollup path.
 *
 * Quotation display currency (header CCY) is used for Price labels and the
 * creators footer so they match the metrics band.
 */

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import {
  formatDeliverablePrice,
  formatDeliverableTotalClientPrice,
  computeDeliverableTotalClientCost,
  isDeliverableFreeForClient,
} from "@/lib/quotations/quotation-deliverable-commercial";
import {
  hasPricedDeliverables,
  rollupDeliverableCommercials,
} from "@/lib/quotations/quotation-deliverable-rollup";
import { stripDeliverableCommercialAmounts } from "@/lib/quotations/quotation-line-commercial-ssot";
import { fromEgp, toEgp } from "@/lib/commercial/fx-aggregation";

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

function formatAmount(amount: number, currency: string): string {
  return formatDeliverablePrice(amount, currency);
}

/** Convert a line-currency amount into the quotation display currency via EGP. */
export function formatAmountInDisplayCurrency(
  amountInLineCurrency: number,
  lineFxRateToEgp: number,
  displayCurrency: string,
  displayFxRateToEgp: number
): string {
  const amountEgp = toEgp(amountInLineCurrency, lineFxRateToEgp);
  const displayAmount = fromEgp(amountEgp, displayCurrency, displayFxRateToEgp);
  return formatAmount(displayAmount, displayCurrency || "EGP");
}

export type DualCurrencyAmountLabel = {
  /** Amount in the selected entry / line currency. */
  primary: string;
  /** Equivalent in quotation currency when it differs from the entry currency. */
  secondary: string | null;
};

/**
 * Creator line dual money:
 * - primary = original entry currency (what was typed in Cost Detail)
 * - secondary = quotation currency equivalent (header CCY), when different
 *
 * Examples:
 * - Quote EGP, cost USD → "100 USD" / "5,000 EGP"
 * - Quote USD, cost AED → "100 AED" / "27 USD"
 */
export function formatDualCurrencyAmountLabel(
  amountInLineCurrency: number,
  lineCurrency: string,
  lineFxRateToEgp: number,
  quotationCurrency: string,
  quotationFxRateToEgp: number
): DualCurrencyAmountLabel {
  const entry = (lineCurrency || "EGP").toUpperCase();
  const quote = (quotationCurrency || "EGP").toUpperCase();
  const primary = formatAmount(amountInLineCurrency, entry);
  if (entry === quote) {
    return { primary, secondary: null };
  }
  return {
    primary,
    secondary: formatAmountInDisplayCurrency(
      amountInLineCurrency,
      lineFxRateToEgp,
      quote,
      quotationFxRateToEgp
    ),
  };
}

/** Format an EGP total in the quotation display currency (header/footer parity). */
export function formatEgpTotalInDisplayCurrency(
  amountEgp: number,
  displayCurrency: string,
  displayFxRateToEgp: number
): string {
  const displayAmount = fromEgp(amountEgp, displayCurrency, displayFxRateToEgp);
  return formatAmount(displayAmount, displayCurrency || "EGP");
}

/** Line Master client cost (base revenue + AF%) in line currency. */
export function lineDraftClientCost(draft: QuotationRowDraft): number {
  if (draft.revenue <= 0) return 0;
  const afPct = draft.afPct > 0 ? draft.afPct : 0;
  return draft.revenue + (draft.revenue * afPct) / 100;
}

/** True when deliverable rollup already matches the line Master draft. */
export function deliverablesMatchLineDraft(
  deliverables: QuotationDeliverable[],
  draft: QuotationRowDraft
): boolean {
  if (!hasPricedDeliverables(deliverables)) {
    return draft.cost <= 0 && draft.revenue <= 0;
  }
  const rolled = rollupDeliverableCommercials(deliverables, {
    lineCurrency: draft.costCurrency || "EGP",
    fxRateToEgp: draft.fxRateToEgp > 0 ? draft.fxRateToEgp : 1,
    lineAfPct: draft.afPct,
  });
  if (!rolled) return draft.cost <= 0 && draft.revenue <= 0;
  return (
    nearlyEqual(rolled.cost, draft.cost) &&
    nearlyEqual(rolled.revenue, draft.revenue) &&
    nearlyEqual(rolled.gpPct, draft.gpPct) &&
    nearlyEqual(rolled.afPct, draft.afPct)
  );
}

/**
 * Project line Master commercials onto deliverable rows for live UI sync.
 * First row receives Master amounts; remaining rows keep type/qty/platform only.
 */
export function projectLineDraftOntoDeliverables(
  deliverables: QuotationDeliverable[],
  draft: QuotationRowDraft
): QuotationDeliverable[] {
  const list =
    deliverables.length > 0
      ? deliverables
      : [
          {
            platform: "",
            type: "",
            types: [],
            type_lines: [{ type: "", quantity: 1 }],
            quantity: 1,
            cost: null,
            revenue: null,
            gp_pct: null,
            gp_value: null,
            af_pct: null,
            cost_currency: draft.costCurrency || "EGP",
          } satisfies QuotationDeliverable,
        ];

  const cleared = stripDeliverableCommercialAmounts(list);
  if (draft.cost <= 0 && draft.revenue <= 0) return cleared;

  return cleared.map((deliverable, index) => {
    if (index !== 0) return deliverable;
    return {
      ...deliverable,
      commercial_input_mode: draft.mode,
      cost: draft.cost,
      revenue: draft.revenue,
      gp_pct: draft.gpPct,
      gp_value: draft.gpValue,
      af_pct: draft.afPct,
      cost_currency: draft.costCurrency || deliverable.cost_currency || "EGP",
      free_for_client: false,
    };
  });
}

type CreatorLinePriceOptions = {
  currency?: string;
  fxRateToEgp?: number;
  fallbackAfPct?: number | null;
  /** When true, this row may show the full line Master total as fallback. */
  allowLineMasterFallback?: boolean;
  /** Prefer Master over deliverable breakdown (single pricing row). */
  preferLineMaster?: boolean;
  /** Quotation currency (header CCY) for secondary equivalent. */
  displayCurrency?: string;
  displayFxRateToEgp?: number;
};

function resolveCreatorLineClientAmount(
  deliverable: QuotationDeliverable,
  draft: QuotationRowDraft | undefined,
  options?: CreatorLinePriceOptions
): { amount: number; lineCurrency: string; lineFx: number } | "Free" | null {
  const lineCurrency =
    options?.currency ||
    deliverable.cost_currency ||
    draft?.costCurrency ||
    "EGP";
  const lineFx = options?.fxRateToEgp ?? draft?.fxRateToEgp ?? 1;

  if (isDeliverableFreeForClient(deliverable)) return "Free";

  const preferMaster =
    Boolean(options?.preferLineMaster || options?.allowLineMasterFallback) &&
    draft != null &&
    (draft.revenue > 0 || draft.cost > 0) &&
    (options?.preferLineMaster === true ||
      !hasPricedDeliverables([deliverable]) ||
      (draft != null && !deliverablesMatchLineDraft([deliverable], draft)));

  if (preferMaster && draft) {
    const clientCost = lineDraftClientCost(draft);
    if (clientCost <= 0) return null;
    // Prefer explicit Cost Detail / options currency so dual-label keeps entry CCY.
    return {
      amount: clientCost,
      lineCurrency,
      lineFx: draft.fxRateToEgp > 0 ? draft.fxRateToEgp : lineFx,
    };
  }

  const fromDeliverable = formatDeliverableTotalClientPrice(deliverable, lineCurrency, lineFx, {
    freeForClient: deliverable.free_for_client === true,
    fallbackAfPct: options?.fallbackAfPct ?? draft?.afPct,
  });
  if (fromDeliverable === "—") {
    if (!options?.allowLineMasterFallback || !draft) return null;
    const clientCost = lineDraftClientCost(draft);
    if (clientCost <= 0) return null;
    return {
      amount: clientCost,
      lineCurrency,
      lineFx: draft.fxRateToEgp > 0 ? draft.fxRateToEgp : lineFx,
    };
  }

  return {
    amount: computeDeliverableTotalClientCost(
      deliverable,
      lineFx,
      options?.fallbackAfPct ?? draft?.afPct
    ),
    lineCurrency,
    lineFx,
  };
}

/**
 * Client price for a creator pricing row.
 * Primary = selected entry currency; secondary = quotation currency equivalent.
 */
export function resolveCreatorLinePriceDualLabel(
  deliverable: QuotationDeliverable,
  draft: QuotationRowDraft | undefined,
  options?: CreatorLinePriceOptions
): DualCurrencyAmountLabel {
  const resolved = resolveCreatorLineClientAmount(deliverable, draft, options);
  if (resolved === "Free") return { primary: "Free", secondary: null };
  if (!resolved) return { primary: "—", secondary: null };

  const quotationCurrency = (
    options?.displayCurrency ||
    resolved.lineCurrency ||
    "EGP"
  ).toUpperCase();
  const quotationFx =
    options?.displayFxRateToEgp ??
    (quotationCurrency === "EGP" ? 1 : resolved.lineFx);

  return formatDualCurrencyAmountLabel(
    resolved.amount,
    resolved.lineCurrency,
    resolved.lineFx,
    quotationCurrency,
    quotationFx
  );
}

/**
 * Client price label for a creator pricing row (primary entry-currency string).
 * Prefer line Master when this is the sole pricing row (matches header totals SSOT).
 */
export function resolveCreatorLinePriceLabel(
  deliverable: QuotationDeliverable,
  draft: QuotationRowDraft | undefined,
  options?: CreatorLinePriceOptions
): string {
  return resolveCreatorLinePriceDualLabel(deliverable, draft, options).primary;
}

/** Vendor cost dual label (entry currency + quotation equivalent). */
export function resolveCreatorLineCostDualLabel(
  draft: QuotationRowDraft | undefined,
  options?: {
    cost?: number | null;
    currency?: string;
    fxRateToEgp?: number;
    displayCurrency?: string;
    displayFxRateToEgp?: number;
  }
): DualCurrencyAmountLabel {
  const amount = Number(options?.cost ?? draft?.cost ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { primary: "—", secondary: null };
  }
  const lineCurrency = (
    options?.currency ||
    draft?.costCurrency ||
    "EGP"
  ).toUpperCase();
  const lineFx = options?.fxRateToEgp ?? draft?.fxRateToEgp ?? 1;
  const quotationCurrency = (options?.displayCurrency || lineCurrency).toUpperCase();
  const quotationFx =
    options?.displayFxRateToEgp ?? (quotationCurrency === "EGP" ? 1 : lineFx);
  return formatDualCurrencyAmountLabel(
    amount,
    lineCurrency,
    lineFx,
    quotationCurrency,
    quotationFx
  );
}
