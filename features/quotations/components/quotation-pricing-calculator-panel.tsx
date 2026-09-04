"use client";

import { useMemo, useState } from "react";

import {
  DiscoverySuiteCell,
  DiscoverySuiteGrid,
  DiscoverySuiteRow,
} from "@/features/discovery/components/design-system";
import { ini } from "@/lib/discovery/suite/helpers";
import {
  F2,
  QUOTATION_CALC_MODES,
  buildQuotationCalcPreview,
  sumQuotationCalcPreview,
  type QuotationCalcLineInput,
  type QuotationCalcMode,
} from "@/lib/quotations/quotation-pricing-calculator";
import { cn } from "@/lib/utils";

const CALC_COLS =
  "minmax(150px,1.2fr) 104px 112px 112px 100px 74px 108px 92px";

type Props = {
  open: boolean;
  lines: QuotationCalcLineInput[];
  onClose: () => void;
  onApply: (updates: Array<{ id: string; newClient: number }>) => void;
  busy?: boolean;
};

/**
 * Pack Overlay C — `.tw-calcp` pricing calculator.
 * Formula printed next to each mode; totals end in Client pays; Apply blocked when any line is below cost.
 */
export function QuotationPricingCalculatorPanel({
  open,
  lines,
  onClose,
  onApply,
  busy,
}: Props) {
  const [mode, setMode] = useState<QuotationCalcMode>("af");
  const [value, setValue] = useState(QUOTATION_CALC_MODES.af.defaultValue);
  const [vatPct, setVatPct] = useState(14);

  const meta = QUOTATION_CALC_MODES[mode];

  const rows = useMemo(
    () => buildQuotationCalcPreview(lines, mode, value, vatPct),
    [lines, mode, value, vatPct]
  );
  const totals = useMemo(() => sumQuotationCalcPreview(rows), [rows]);

  if (!open || lines.length === 0) return null;

  function switchMode(next: QuotationCalcMode) {
    setMode(next);
    setValue(QUOTATION_CALC_MODES[next].defaultValue);
  }

  function parseValue(raw: string): number {
    return Math.max(0, Number(String(raw).replace(/[^\d.]/g, "")) || 0);
  }

  const applyBlocked = totals.hasBelowCost;

  return (
    <div className="discovery-suite">
      <div
        className="tw-calcp"
        role="dialog"
        aria-label="Pricing calculator"
        data-quotation-calculator
      >
        <div className="tw-calcp__h">
          <b>Pricing calculator</b>
          <span>
            {lines.length} line{lines.length === 1 ? "" : "s"} selected · EGP
          </span>
          <span className="tw-sp" />
          <span
            style={{
              font: "500 11px 'Geist Mono',monospace",
              color: "rgba(255,255,255,.86)",
            }}
          >
            {meta.formula}
          </span>
          <button
            type="button"
            className="tw-dr__x"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="tw-calcp__c">
          <div className="tw-modes">
            {(Object.keys(QUOTATION_CALC_MODES) as QuotationCalcMode[]).map(
              (key) => {
                const m = QUOTATION_CALC_MODES[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className="tw-mode"
                    aria-pressed={mode === key}
                    onClick={() => switchMode(key)}
                  >
                    <b>{m.label}</b>
                    <u>{m.formula}</u>
                  </button>
                );
              }
            )}
          </div>
          <div className="tw-cin">
            <div className="tw-f">
              <label>{meta.label.replace("Cost + ", "")}</label>
              <input
                className="tw-in"
                value={String(value)}
                inputMode="decimal"
                aria-label="Value"
                onChange={(event) => setValue(parseValue(event.target.value))}
              />
            </div>
            <div className="tw-f" style={{ flex: "0 0 120px" }}>
              <label>VAT %</label>
              <input
                className="tw-in"
                value={String(vatPct)}
                inputMode="decimal"
                aria-label="VAT"
                onChange={(event) => setVatPct(parseValue(event.target.value))}
              />
            </div>
            {mode === "af" || mode === "gpm" ? (
              <span
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  paddingBottom: 3,
                }}
              >
                {[10, 15, 20, 25, 30, 35].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="tw-chip"
                    onClick={() => setValue(chip)}
                  >
                    {chip}%
                  </button>
                ))}
              </span>
            ) : null}
            <span className="tw-sp" />
            <span className="tw-cs">Applies to the selected lines only</span>
          </div>
        </div>

        <div className="tw-calcp__b">
          <DiscoverySuiteGrid
            cols={CALC_COLS}
            minWidth={860}
            framed={false}
            header={
              <>
                <DiscoverySuiteCell>Creator</DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  Base cost
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  Client now
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  New client
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  GP
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  Margin
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  VAT {vatPct}%
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  Change
                </DiscoverySuiteCell>
              </>
            }
            footer={
              <>
                <DiscoverySuiteCell>{rows.length} lines</DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-v" align="end">
                  {F2(totals.baseCost)}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-v z" align="end">
                  {F2(totals.clientNow)}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-v" align="end">
                  {F2(totals.newClient)}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell
                  className={cn("tw-v", totals.gp > 0 ? "pos" : "neg")}
                  align="end"
                >
                  {F2(totals.gp)}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-v" align="end">
                  {totals.marginPct.toFixed(1)}%
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-v neg" align="end">
                  {F2(totals.vat)}
                </DiscoverySuiteCell>
                <DiscoverySuiteCell className="tw-rr" align="end">
                  <span
                    className={cn(
                      "tw-delta",
                      totals.change >= 0 ? "up" : "dn"
                    )}
                  >
                    {totals.change >= 0 ? "+" : ""}
                    {F2(totals.change)}
                  </span>
                </DiscoverySuiteCell>
              </>
            }
          >
            {rows.map((row, index) => {
              const up = row.delta >= 0;
              const tone = ((index % 3) + 2) as 2 | 3 | 4;
              return (
                <DiscoverySuiteRow key={row.id} bad={row.belowCost}>
                  <DiscoverySuiteCell>
                    <span className="tw-cw2" style={{ gap: 8 }}>
                      <span
                        className={cn("tw-av", `k${tone}`)}
                        style={{ width: 26, height: 26, fontSize: 10 }}
                      >
                        {ini(row.name).slice(0, 1)}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <b
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.name}
                        </b>
                        <span className="hd" style={{ fontSize: 10 }}>
                          Option {row.optionNumber}
                        </span>
                      </span>
                    </span>
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-v" align="end">
                    {F2(row.baseCost)}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-v z" align="end">
                    {F2(row.clientNow)}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell
                    className={cn("tw-v", row.belowCost && "neg")}
                    align="end"
                  >
                    <b>{F2(row.newClient)}</b>
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell
                    className={cn("tw-v", row.gp > 0 ? "pos" : "neg")}
                    align="end"
                  >
                    {F2(row.gp)}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell
                    className={cn("tw-v", row.gp > 0 ? undefined : "neg")}
                    align="end"
                  >
                    {row.marginPct.toFixed(1)}%
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-v neg" align="end">
                    {F2(row.vat)}
                  </DiscoverySuiteCell>
                  <DiscoverySuiteCell className="tw-rr" align="end">
                    <span className={cn("tw-delta", up ? "up" : "dn")}>
                      {up ? "+" : ""}
                      {F2(row.delta)}
                    </span>
                  </DiscoverySuiteCell>
                </DiscoverySuiteRow>
              );
            })}
          </DiscoverySuiteGrid>
        </div>

        {totals.hasBelowCost ? (
          <div className="tw-warnrow">
            ⚠ {totals.belowCostCount} line
            {totals.belowCostCount === 1 ? "" : "s"} would sit at or below cost —
            GP is zero or negative. Apply is blocked until every line clears base
            cost.
          </div>
        ) : null}
        {mode === "gpm" && value >= 100 ? (
          <div className="tw-warnrow">
            ⚠ A margin of 100% or more cannot be solved; client cost is held at
            base cost.
          </div>
        ) : null}
        {mode === "price" ? (
          <div className="tw-warnrow">
            ⚠ Client price sets the <b>same</b> figure on every selected line,
            ignoring each creator&apos;s cost.
          </div>
        ) : null}

        <div className="tw-calcp__f">
          <div>
            <i>Base cost</i>
            <b>{F2(totals.baseCost)}</b>
          </div>
          <div>
            <i>New client cost</i>
            <b>{F2(totals.newClient)}</b>
          </div>
          <div>
            <i>Gross profit</i>
            <b className={totals.gp > 0 ? "g" : "r"}>{F2(totals.gp)}</b>
          </div>
          <div>
            <i>Margin</i>
            <b className={totals.gp > 0 ? "g" : "r"}>
              {totals.marginPct.toFixed(1)}%
            </b>
          </div>
          <div>
            <i>VAT {vatPct}%</i>
            <b>{F2(totals.vat)}</b>
          </div>
          <div>
            <i>Client pays</i>
            <b>{F2(totals.clientPays)}</b>
          </div>
          <div>
            <i>Change</i>
            <b className={totals.change >= 0 ? "g" : "r"}>
              {totals.change >= 0 ? "+" : ""}
              {F2(totals.change)}
            </b>
          </div>
        </div>

        <div className="tw-calcp__a">
          <span className="tw-cs">
            Nothing is written until you apply. AF is added to what the client
            pays and is <b>not</b> counted as GP.
          </span>
          <span className="tw-sp" />
          <button type="button" className="tw-b sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="tw-b sm pri"
            disabled={busy || applyBlocked}
            title={
              applyBlocked
                ? "Fix lines priced below base cost before Apply"
                : undefined
            }
            onClick={() =>
              onApply(rows.map((r) => ({ id: r.id, newClient: r.newClient })))
            }
          >
            Apply to {lines.length} line{lines.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
