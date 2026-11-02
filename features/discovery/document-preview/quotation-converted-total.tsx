"use client";

import { useEffect, useState } from "react";
import { loadQuotationDisplayRate } from "./quotation-display-rate";
import type { QuotationItemRow } from "@/features/quotations/types";
import { COMMERCIAL_CURRENCIES } from "@/lib/commercial/fx-aggregation";
import { computeQuotationDisplayTotals, draftFromQuotationItem } from "@/features/quotations/quotation-row-math";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import styles from "./creator-dialog.module.css";

export type QuotationTotalSource = {
  items: QuotationItemRow[];
  currency: string;
  issueDate?: string | null;
};

export function QuotationConvertedTotal({ source, itemIds }: { source: QuotationTotalSource; itemIds: string[] }) {
  const [currency, setCurrency] = useState(() => (source.currency || "EGP").toUpperCase());
  const [resolved, setResolved] = useState<{ currency: string; date?: string | null; rate?: number; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (currency === "EGP") return;
    let cancelled = false;
    loadQuotationDisplayRate(currency, source.issueDate).then(result => {
      if (cancelled) return;
      const rate = result.rate;
      setResolved({ currency, date: source.issueDate, ...(rate && Number.isFinite(rate) && rate > 0 ? {rate} : {error: `No exchange rate available for ${currency}.`}) });
    }).catch(() => {
      if (!cancelled) setResolved({ currency, date: source.issueDate, error: `Could not load the ${currency} exchange rate.` });
    });
    return () => { cancelled = true; };
  }, [currency, source.issueDate, attempt]);

  const current = resolved?.currency === currency && resolved.date === source.issueDate ? resolved : null;
  const rate = currency === "EGP" ? 1 : current?.rate;
  const selectedIds = new Set(itemIds);
  const totals = rate ? computeQuotationDisplayTotals(source.items.filter(item => selectedIds.has(item.id)).map(draftFromQuotationItem), currency, rate) : null;
  const metrics = totals ? [
    { label: "Client cost", value: formatMoneyKpi(totals.revenue, currency) },
    { label: "Agency fee", value: formatMoneyKpi(totals.af, currency) },
    { label: "Total incl. AF", value: formatMoneyKpi(totals.clientCost, currency) },
  ] : [];
  const currencies = [...new Set([...COMMERCIAL_CURRENCIES, (source.currency || "EGP").toUpperCase()])];

  return <section className={styles.convertedZone} aria-label="Selected total in chosen currency">
    <div className={styles.convertedHeading}>
      <h3>Selected total · converted currency</h3>
      <label>Currency<select aria-label="Total currency" value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code} value={code}>{code}{code === source.currency.toUpperCase() ? " · Quotation currency" : ""}</option>)}</select></label>
      {rate && <small className={styles.conversionRate}>Reference: 1 {currency} = {rate.toLocaleString("en-US", { maximumFractionDigits: 8 })} EGP{source.issueDate ? ` · ${source.issueDate.slice(0, 10)}` : ""}. Line-specific agreed rates apply.</small>}
    </div>
    <div aria-live="polite" aria-busy={!rate && !current?.error}>
      {rate ? <dl className={styles.convertedFigures}>{metrics.map(metric => <div key={metric.label} className={metric.label === "Total incl. AF" ? styles.convertedGrandTotal : undefined}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
        : current?.error ? <p role="status">{current.error} <button type="button" className={styles.button} onClick={() => {setResolved(null); setAttempt(value => value + 1);}}>Retry</button></p>
        : <p role="status">Loading {currency} total…</p>}
    </div>
  </section>;
}
