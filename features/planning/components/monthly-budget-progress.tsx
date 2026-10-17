"use client";

import { useState } from "react";
import type { MonthlyBudgetRow } from "@/lib/planning/budgets/monthly-budget";
import { Button } from "@/components/ui/button";

export function MonthlyBudgetProgress({ rows, currency, unallocated }: { rows: MonthlyBudgetRow[]; currency: string; unallocated: number }) {
  const [metric, setMetric] = useState<"Revenue" | "Cost" | "Gp">("Revenue");
  if (!rows.length) return null;
  const format = (n: number) => new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const budget = (r: MonthlyBudgetRow) => r[`budget${metric}`];
  const actual = (r: MonthlyBudgetRow) => r[`actual${metric}`];
  const sum = (list: MonthlyBudgetRow[], pick: (r: MonthlyBudgetRow) => number) => list.reduce((n, r) => n + pick(r), 0);
  const completed = rows.filter(r => r.status === "Completed");
  const annual = sum(rows, budget);
  const actualToDate = sum(rows, actual);
  const ytdBudget = sum(completed, budget);
  const ytdActual = sum(completed, actual);
  const percentage = (a: number, b: number) => b === 0 ? "—" : `${((a - b) / Math.abs(b) * 100).toFixed(1)}%`;
  const favorable = (delta: number) => metric === "Cost" ? delta <= 0 : delta >= 0;
  return <section className="space-y-4" aria-label="Monthly actual versus budget">
    <div><h3 className="font-heading text-lg font-semibold">Monthly actual vs budget · {currency}</h3>
      <p className="text-sm text-muted-foreground">Actual revenue and direct campaign costs follow live publication recognition dates, excluding VAT. Current month is partial. Currency conversion follows reporting exchange rates.</p></div>
    {unallocated > 0 ? <p role="alert" className="text-sm text-destructive">{unallocated} budget line(s) have no monthly allocation and are excluded below. Edit them in Budget versions to assign a month, or create a monthly version.</p> : null}
    <div className="flex flex-wrap gap-2" aria-label="Comparison metric">{(["Revenue", "Cost", "Gp"] as const).map(m => <Button key={m} size="sm" variant={metric === m ? "default" : "outline"} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === "Gp" ? "Gross profit" : m}</Button>)}</div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Annual budget</p><p className="text-xl font-semibold">{format(annual)}</p></div>
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Actual to date · {metric === "Cost" ? "budget used" : "annual achievement"}</p><p className="text-xl font-semibold">{format(actualToDate)}</p><p className="text-sm">{annual > 0 ? `${(actualToDate / annual * 100).toFixed(1)}%` : "No positive annual target"}</p></div>
      <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">YTD variance · completed months only</p><p className="text-xl font-semibold">{format(ytdActual - ytdBudget)} ({percentage(ytdActual, ytdBudget)})</p><p className="text-sm">Actual {format(ytdActual)} / budget {format(ytdBudget)}</p></div>
    </div>
    {completed.some(r => !r.hasBudget) ? <p className="text-sm text-muted-foreground">Some completed months have no budget. YTD comparison is incomplete until those months are entered.</p> : null}
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
      <caption className="sr-only">Monthly {metric === "Gp" ? "gross profit" : metric.toLowerCase()} in {currency}. Variance equals actual minus budget.</caption>
      <thead><tr className="border-b bg-muted/50">{["Month", "Status", "Budget", "Actual", "Variance", "Variance %", "Result"].map(h => <th key={h} scope="col" className="whitespace-nowrap px-3 py-3 text-left">{h}</th>)}</tr></thead>
      <tbody>{rows.map(r => {
        const delta = actual(r) - budget(r);
        const comparable = r.hasBudget && r.status !== "Upcoming";
        return <tr key={r.key} className="border-b last:border-0">
          <th scope="row" className="px-3 py-3 text-left font-medium">{r.label}</th><td className="px-3 py-3 whitespace-nowrap">{r.status}</td>
          <td className="px-3 py-3 tabular-nums">{r.hasBudget ? format(budget(r)) : "Not set"}</td>
          <td className="px-3 py-3 tabular-nums">{r.status === "Upcoming" ? "—" : format(actual(r))}</td>
          <td className="px-3 py-3 tabular-nums">{comparable ? format(delta) : "—"}</td><td className="px-3 py-3">{comparable ? percentage(actual(r), budget(r)) : "—"}</td>
          <td className={`px-3 py-3 ${comparable && !favorable(delta) ? "text-destructive" : ""}`}>{comparable ? delta === 0 ? "On budget" : favorable(delta) ? "Favorable" : "Unfavorable" : "—"}</td>
        </tr>;
      })}</tbody>
    </table></div>
    <p className="text-xs text-muted-foreground">Variance = actual − budget. Lower cost is favorable. “Not set” differs from an explicitly entered zero budget. YTD uses January through the last completed month.</p>
  </section>;
}
