import { QuotationText } from "./quotation-design-locale";

import { F } from "@/lib/discovery/suite/helpers";
import { cn } from "@/lib/utils";
import { resolveQuotationHeaderCommercialTotals } from "@/features/quotations/quotation-row-math";
import { computeQuotationTotals } from "@/lib/commercial/quotation-engine";

type Props = {
  selectedCount: number;
  totalCount: number;
  baseCost: number;
  clientCost: number;
  agencyFees: number;
  calculatorOpen: boolean;
  busy?: boolean;
  onClear: () => void;
  onCompare?: () => void;
  onToggleCalculator: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMore?: () => void;
  onMoveToCampaign?: () => void;
  onAddToCampaign?: () => void;
};

/**
 * Pack Overlay B — `.tw-selbar` fixed / centred / bottom:20px (not sticky, not in flow).
 */
export function QuotationSelectionBar({
  selectedCount,
  totalCount,
  baseCost,
  clientCost,
  agencyFees,
  calculatorOpen,
  busy,
  onClear,
  onCompare,
  onToggleCalculator,
  onDuplicate,
  onDelete,
  onMore,
  onAddToCampaign,
  onMoveToCampaign,
}: Props) {
  if (selectedCount <= 0) return null;

  // Selection amounts already include each line's negotiated cost/revenue FX.
  // Use the header formula so agency fees contribute to GP and its denominator.
  const totals = resolveQuotationHeaderCommercialTotals(computeQuotationTotals([{
    cost_egp: baseCost,
    revenue_egp: clientCost,
    af_value_egp: agencyFees,
    gp_value_egp: clientCost - baseCost,
  }]));
  const gp = totals.headerGpValueEgp;
  const gpPct = totals.headerGpPct;
  const gpTone = gp > 0 ? "g" : undefined;

  return (
    <div className="discovery-suite">
      <div
        className="tw-selbar"
        role="toolbar"
        aria-label="Quotation line selection"
        data-quotation-selbar
      >
        <span className="n">
          <b>{selectedCount}</b> of {totalCount} <QuotationText>lines</QuotationText><button
            type="button"
            className="x"
            aria-label="Clear selection"
            disabled={busy}
            onClick={onClear}
          >
            ×
          </button>
        </span>
        <span className="sum">
          <span>
            <i>Base cost</i>
            <b>{F(baseCost)}</b>
          </span>
          <span>
            <i><QuotationText>Before fees</QuotationText></i>
            <b>{F(clientCost)}</b>
          </span>
          <span><i><QuotationText>Agency Fees</QuotationText></i><b>{F(agencyFees)}</b></span>
          <span><i><QuotationText>Total investment</QuotationText></i><b>{F(totals.totalClientCostEgp)}</b></span>
          <span>
            <i>GP</i>
            <b className={gpTone}>{F(gp)}</b>
          </span>
          <span>
            <i><QuotationText>GP %</QuotationText></i>
            <b className={gpTone}>{gpPct.toFixed(1)}%</b>
          </span>
        </span>
        <span className="acts">
          {onCompare && <button type="button" className="tw-b sm" disabled={busy || selectedCount < 2} onClick={onCompare}><QuotationText>Compare</QuotationText></button>}
          {onMoveToCampaign && <button type="button" className="tw-b sm pri" disabled={busy || selectedCount === 0} onClick={onMoveToCampaign}>Move selected to campaign</button>}
          {onAddToCampaign && <button type="button" className="tw-b sm pri" disabled={busy || selectedCount === 0} onClick={onAddToCampaign}>Add to existing campaign</button>}
          <button
            type="button"
            className={cn("tw-b sm", calculatorOpen && "pri")}
            disabled={busy}
            onClick={onToggleCalculator}
            aria-pressed={calculatorOpen}
          >
            ▦ Calculator
          </button>
          <button
            type="button"
            className="tw-b sm"
            disabled={busy}
            onClick={onDuplicate}
          >
            <QuotationText>Duplicate</QuotationText></button>
          <button
            type="button"
            className="tw-b sm edit"
            disabled={busy}
            onClick={onDelete}
          >
            <QuotationText>Delete</QuotationText> {selectedCount}
          </button>
          <button
            type="button"
            className="tw-b sm"
            disabled={busy || !onMore}
            onClick={onMore}
            aria-label="More actions"
          >
            ⋯
          </button>
        </span>
      </div>
    </div>
  );
}
