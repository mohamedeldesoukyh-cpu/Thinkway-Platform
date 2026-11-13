"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OperationalTableColumnSettingsList } from "@/components/tables/operational-table-column-settings-list";
import { operationalTableChrome, OperationalTableIcons, OperationalTableToolbarButton } from "@/components/tables/operational-table-chrome";
import { reorderTableColumns } from "@/lib/tables/operational-table-column-settings";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { ReportExportActions } from "@/features/reports/components/report-export-actions";
import { DEFAULT_OVERVIEW_COLUMNS, OVERVIEW_COLUMNS, type OverviewFilters, type OverviewReport, type OverviewRow } from "@/lib/reports/overview/overview-report";
import { cn } from "@/lib/utils";

const amount = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const selectClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-xs";
export function OverviewReportView({ report }: { report: OverviewReport }) {
  // The key resets the draft after back/forward navigation or an applied filter.
  return <OverviewReportContent key={JSON.stringify(report.filters)} report={report} />;
}
function OverviewReportContent({ report }: { report: OverviewReport }) {
  const router = useRouter(), pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(report.filters);
  const [columns, setColumns] = useState(report.filters.columns);
  const [columnOrder, setColumnOrder] = useState([...report.filters.columns, ...OVERVIEW_COLUMNS.map(c => c.key).filter(key => !report.filters.columns.includes(key))]);
  const update = (key: keyof OverviewFilters, value: string) => setDraft(old => ({ ...old, [key]: value,
    ...(key === "groupId" ? { clientId: "", brandId: "", campaignId: "" } : key === "clientId" ? { brandId: "", campaignId: "" } : key === "brandId" ? { campaignId: "" } : {}) }));
  const apply = () => {
    const params = new URLSearchParams();
    Object.entries(draft).forEach(([key, value]) => { if (key !== "columns" && value) params.set(key, String(value)); });
    params.set("columns", columnOrder.filter(key => columns.includes(key)).join(","));
    startTransition(() => router.push(`${pathname}?${params}`));
  };
  const orderedColumns = columnOrder.map(key => OVERVIEW_COLUMNS.find(c => c.key === key)!);
  const visible = orderedColumns.filter(c => columns.includes(c.key));
  const cell = (row: OverviewRow, total = false) => visible.map((c, i) => <td key={c.key} className={cn("px-3 py-2.5", c.numeric ? "text-right tabular-nums whitespace-nowrap" : "min-w-32 max-w-64 break-words", c.accrued && "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100")}>
    {c.numeric ? amount(row[c.key]) : total ? i === visible.findIndex(v => !v.numeric) ? "Totals" : "" : row[c.key]}
  </td>);
  const selects = [["groupId", "Group"], ["clientId", "Client"], ["brandId", "Brand"], ["campaignId", "Campaign"], ["status", "Campaign status"], ["currency", "Display currency"]] as const;
  return <div className="space-y-4" aria-busy={pending}>
    <form onSubmit={e => { e.preventDefault(); apply(); }} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {selects.map(([key, label]) => <label key={key} className="grid gap-1 text-xs text-muted-foreground">{label}
          <select className={selectClass} value={draft[key]} onChange={e => update(key, e.target.value)}>
            {key !== "currency" && <option value="">All</option>}
            {report.options[key].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>)}
        <label className="grid gap-1 text-xs text-muted-foreground">Client type<select className={selectClass} value={draft.clientType} onChange={e => update("clientType", e.target.value)}><option value="">All</option><option value="agency">Agency</option><option value="direct">Direct</option></select></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Activity<select className={selectClass} value={draft.activity} onChange={e => update("activity", e.target.value)}><option value="">All</option><option value="actual">Has went-live activity</option><option value="accrued">Has accrual amounts</option><option value="both">Actual and accrued</option></select></label>
        {([["from", "Campaign start from"], ["to", "Campaign start to"], ["asOf", "Went live as of"]] as const).map(([key,label]) => <label key={key} className="grid gap-1 text-xs text-muted-foreground">{label}<Input type="date" className="h-9 text-xs" value={draft[key]} onChange={e => update(key, e.target.value)} /></label>)}
        <label className="grid gap-1 text-xs text-muted-foreground">Search<Input className="h-9 text-xs" value={draft.q} placeholder="Group, client, brand, campaign" onChange={e => update("q", e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2"><Button type="submit" size="sm" disabled={pending}>{pending ? "Applying…" : "Apply filters"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => startTransition(() => router.push(pathname))}>Reset</Button></div>
        <ReportExportActions apiPath="/api/reports/overview/document" fixedParams={{ columns: visible.map(c => c.key).join(",") }} disabled={pending} />
      </div>
      <div className="flex justify-end">
        <Popover>
          <PopoverTrigger asChild><OperationalTableToolbarButton icon={OperationalTableIcons.settings} label="Settings" /></PopoverTrigger>
          <PopoverContent align="end" className={cn(operationalTableChrome.panelShell, "w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-0")}>
            <div className="border-b border-border/50 px-4 py-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Overview Report</p>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Table settings</h3>
            </div>
            <div className="px-4 py-3">
              <OperationalTableColumnSettingsList
                orderedColumns={orderedColumns.map(c => ({ id: c.key, label: c.label }))}
                state={{ order: columnOrder, visible: Object.fromEntries(OVERVIEW_COLUMNS.map(c => [c.key, columns.includes(c.key)])) }}
                toggleColumnVisibility={(id, shown) => {
                  const key = OVERVIEW_COLUMNS.find(c => c.key === id)?.key;
                  if (!key || (!shown && columns.length === 1)) return;
                  setColumns(old => shown ? [...old, key] : old.filter(k => k !== key));
                }}
                moveColumn={(from, to) => setColumnOrder(old => reorderTableColumns(old, from, to) as typeof old)}
                resetToDefault={() => { setColumns([...DEFAULT_OVERVIEW_COLUMNS]); setColumnOrder(OVERVIEW_COLUMNS.map(c => c.key)); }}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </form>
    <OperationalTableSection wide tableOnly cardSurface>
      <div className="space-y-3 p-4 md:p-6">
        <div className="space-y-1"><h2 className="text-sm font-semibold">Overview Report · {report.filters.currency}</h2>
          <p className="text-xs text-muted-foreground">{report.rows.length} campaigns · Went live as of {report.filters.asOf} · Amounts before VAT.</p>
          <p className="text-xs text-muted-foreground">Actual: went-live activity. <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">Acc.: not yet live</span>. Total = actual + accrued. GP = revenue − cost.</p>
          <p className="text-xs text-muted-foreground">Dates filter campaign start dates. The as-of date splits current campaign values by publication date; it is not a historical accounting snapshot.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border/70"><table className="w-full border-collapse text-xs"><caption className="sr-only">Overview Report in {report.filters.currency}. Totals cover all filtered campaigns.</caption>
          <thead><tr className="border-b border-border/70 bg-muted/25 text-[11px] uppercase tracking-wide text-muted-foreground">{visible.map(c => <th key={c.key} scope="col" className={cn("px-3 py-2 font-semibold", c.numeric ? "text-right whitespace-nowrap" : "text-left", c.accrued && "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100")}>{c.label}</th>)}</tr></thead>
          <tbody>{report.rows.length ? report.rows.map(row => <tr key={row.id} className="border-b border-border/50">{cell(row)}</tr>) : <tr><td colSpan={visible.length} className="py-10 text-center text-muted-foreground">No campaigns match these filters.</td></tr>}</tbody>
          <tfoot><tr aria-label="Totals for all filtered campaigns" className="border-t-2 border-border/70 bg-muted/20 font-semibold">{cell(report.totals, true)}</tr></tfoot>
        </table></div>
      </div>
    </OperationalTableSection>
  </div>;
}
