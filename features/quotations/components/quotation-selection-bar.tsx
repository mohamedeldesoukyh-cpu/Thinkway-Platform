"use client";

import { F } from "@/lib/discovery/suite/helpers";
import { cn } from "@/lib/utils";

type Props = {
  selectedCount: number;
  totalCount: number;
  baseCost: number;
  clientCost: number;
  calculatorOpen: boolean;
  busy?: boolean;
  onClear: () => void;
  onToggleCalculator: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMore?: () => void;
};

/**
 * Pack Overlay B — `.tw-selbar` fixed / centred / bottom:20px (not sticky, not in flow).
 */
export function QuotationSelectionBar({
  selectedCount,
  totalCount,
  baseCost,
  clientCost,
  calculatorOpen,
  busy,
  onClear,
  onToggleCalculator,
  onDuplicate,
  onDelete,
  onMore,
}: Props) {
  if (selectedCount <= 0) return null;

  const gp = clientCost - baseCost;
  const gpPct = clientCost ? (gp / clientCost) * 100 : 0;
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
          <b>{selectedCount}</b> of {totalCount} lines
          <button
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
            <i>Client cost</i>
            <b>{F(clientCost)}</b>
          </span>
          <span>
            <i>GP</i>
            <b className={gpTone}>{F(gp)}</b>
          </span>
          <span>
            <i>GP %</i>
            <b className={gpTone}>{gpPct.toFixed(1)}%</b>
          </span>
        </span>
        <span className="acts">
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
            Duplicate
          </button>
          <button
            type="button"
            className="tw-b sm edit"
            disabled={busy}
            onClick={onDelete}
          >
            Delete {selectedCount}
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
