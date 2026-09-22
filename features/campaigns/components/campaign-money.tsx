"use client";

import { createContext, useContext, type ReactNode } from "react";
import { creatorFxAmount } from "@/lib/commercial/creator-fx";
import { convertMoney } from "@/lib/billing/billing-currency";
import { formatMoney } from "@/features/campaigns/utils";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { aggregateCampaignDisplayFinancials } from "@/lib/campaigns/campaign-display-financials";

const CurrencyContext = createContext<CampaignWorkspace | null>(null);
export function CampaignCurrencyProvider({ workspace, children }: { workspace: CampaignWorkspace; children: ReactNode }) {
  return <CurrencyContext.Provider value={workspace}>{children}</CurrencyContext.Provider>;
}
export function useCampaignCurrency() { return useContext(CurrencyContext); }

export function CampaignMoney({ amount, currency, override }: { amount: number; currency: string; override?: string | null }) {
  const workspace = useCampaignCurrency();
  const target = workspace?.currency_code ?? currency;
  let converted: number;
  try { converted = creatorFxAmount(amount, { from: currency, to: target, sourceRateToEgp: workspace?.currency_rates?.[currency] ?? 0, targetRateToEgp: workspace?.currency_rates?.[target] ?? 0, override }); }
  catch { return <span title={`No conversion rate available for ${currency} to ${target}`}>FX unavailable<small className="block text-[10px] font-normal text-muted-foreground">{formatMoney(amount, currency)}</small></span>; }
  return <span className="inline-flex flex-col tabular-nums">
    <span>{formatMoney(converted, target)}</span>
    {currency !== target && <small className="text-[10px] font-normal leading-tight text-muted-foreground">{formatMoney(amount, currency)} original</small>}
  </span>;
}
/** JSX formatter for read-only cells; never use in document generation or editor inputs. */
export function campaignMoney(amount: number, currency: string, override?: string | null) { return <CampaignMoney amount={amount} currency={currency} override={override} />; }

export function CampaignMoneyTotal({ amounts, currency, displayAmount }: { amounts: { amount: number; currency: string }[]; currency: string; displayAmount?: number }) {
  const workspace = useCampaignCurrency();
  const target = workspace?.currency_code ?? currency;
  const originals = new Map<string, number>();
  let total = 0;
  for (const entry of amounts) {
    total += convertMoney(entry.amount, entry.currency, target, workspace?.currency_rates ?? {});
    originals.set(entry.currency, (originals.get(entry.currency) ?? 0) + entry.amount);
  }
  return <span className="inline-flex flex-col tabular-nums"><span>{formatMoney(displayAmount ?? total, target)}</span>
    {[...originals].filter(([code]) => code !== target).map(([code, value]) => <small key={code} className="text-[10px] font-normal leading-tight text-muted-foreground">{formatMoney(value, code)} original</small>)}
  </span>;
}

export function CampaignLineFinancial({ line, metric }: { line: CampaignWorkspace["lines"][number]; metric: "cost" | "gp" | "margin_percent" }) {
  const workspace = useCampaignCurrency();
  const currency = workspace?.currency_code ?? line.currency_code;
  const financials = aggregateCampaignDisplayFinancials({ lines: [line], displayCurrency: currency,
    rateToEgpByCurrency: new Map(Object.entries(workspace?.currency_rates ?? { [currency]: 1 })) });
  if (metric === "margin_percent") return <span>{financials.margin_percent.toFixed(1)}%</span>;
  return <CampaignSummaryMoney amount={financials[metric]} currency={currency} metric={metric} lines={[line]} />;
}

export function CampaignSummaryMoney({ amount, currency, metric, lines }: { amount: number; currency: string; metric: "revenue" | "cost" | "gp"; lines?: CampaignWorkspace["lines"] }) {
  const workspace = useCampaignCurrency();
  const originals = new Map<string, number>();
  for (const line of lines ?? workspace?.lines ?? []) {
    const revenue = Number(line.revenue_before_vat ?? line.revenue) + Number(line.usage_rights_amount ?? 0) + Number(line.agency_fee_amount ?? 0);
    const cost = Number(line.cost_received ?? line.cost_before_vat ?? line.cost);
    const add = (code: string, value: number) => originals.set(code, (originals.get(code) ?? 0) + value);
    if (metric !== "cost") add(line.currency_code, revenue);
    if (metric === "gp") add(line.currency_code, -Number(line.usage_rights_cost ?? 0));
    if (metric !== "revenue") add(line.cost_received_currency || line.currency_code, metric === "gp" ? -cost : cost);
  }
  return <span className="inline-flex flex-col tabular-nums"><span>{formatMoney(amount, currency)}</span>
    {[...originals].filter(([code]) => code !== currency).map(([code, value]) => <small key={code} className="text-[10px] font-normal leading-tight text-muted-foreground">{formatMoney(value, code)} {metric === "gp" && originals.size > 1 ? "contribution" : "original"}</small>)}
  </span>;
}
