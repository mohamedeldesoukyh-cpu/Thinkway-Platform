"use client";

import { useId, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ReportExportActions } from "@/features/reports/components/report-export-actions";
import { saveOverviewColumns } from "@/features/reports/save-overview-columns-action";
import { normalizeOverviewColumnPreferences, type OverviewColumnPreferences } from "@/lib/reports/overview/overview-column-preferences";
import { orderOverviewColumns, type OverviewColumn, type OverviewFilters, type OverviewReport } from "@/lib/reports/overview/overview-report";
import { cn } from "@/lib/utils";

import { OverviewColumnSettings, type OverviewSaveStatus } from "./overview/overview-column-settings";
import { OverviewFilterPanel } from "./overview/overview-filter-panel";
import styles from "./overview/overview-report.module.css";
import { OverviewReportTable } from "./overview/overview-report-table";
import {
  formatOverviewDate,
  overviewFilterSearchParams,
  withFilterChange,
  type OverviewColumnKind,
} from "./overview/overview-report-ui";

export function OverviewReportView({ report, savedPreferences }: { report: OverviewReport; savedPreferences: OverviewColumnPreferences }) {
  // The key resets the draft after back/forward navigation or an applied filter.
  return (
    <OverviewReportContent
      key={JSON.stringify(report.filters)}
      report={report}
      savedPreferences={savedPreferences}
    />
  );
}

const LEGEND: { kind: OverviewColumnKind; label: string; detail: string }[] = [
  { kind: "actual", label: "Actual", detail: "went-live activity" },
  { kind: "accrued", label: "Acc.", detail: "accrued, not yet live" },
  { kind: "total", label: "Total", detail: "actual + accrued" },
  { kind: "share", label: "Rev. Share", detail: "campaign revenue share" },
];

function OverviewReportContent({
  report,
  savedPreferences,
}: {
  report: OverviewReport;
  savedPreferences: OverviewColumnPreferences;
}) {
  const router = useRouter(), pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(report.filters);
  const [columns, setColumns] = useState(report.filters.columns);
  const [columnOrder, setColumnOrder] = useState(() => {
    const savedVisible = savedPreferences.order.filter(key => savedPreferences.columns.includes(key));
    return JSON.stringify(savedVisible) === JSON.stringify(report.filters.columns)
      ? savedPreferences.order
      : orderOverviewColumns([...report.filters.columns, ...savedPreferences.order.filter(key => !report.filters.columns.includes(key))]);
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<OverviewSaveStatus>(null);
  const [saved, setSaved] = useState(savedPreferences);
  const headingId = useId();

  const visible: OverviewColumn[] = columnOrder.filter(key => columns.includes(key));
  const selectionChanged = JSON.stringify({ columns: visible, order: columnOrder }) !==
    JSON.stringify({ columns: saved.order.filter(key => saved.columns.includes(key)), order: saved.order });

  const persistSelection = async (reset = false) => {
    setSaving(true);
    setSaveStatus(null);
    const next = reset ? normalizeOverviewColumnPreferences(null) : { columns, order: columnOrder };
    try {
      const result = await saveOverviewColumns(next);
      if ("error" in result) throw new Error(result.error);
      setSaved(next);
      if (reset) { setColumns(next.columns); setColumnOrder(next.order); }
      // Keep reloads on the same filtered URL consistent with the saved selection.
      const url = new URL(window.location.href);
      url.searchParams.set("columns", next.order.filter(key => next.columns.includes(key)).join(","));
      window.history.replaceState(null, "", url.toString());
      setSaveStatus({ tone: "success", text: reset ? "Default columns restored for your account." : "Selection saved to your account." });
    } catch {
      setSaveStatus({ tone: "error", text: "Could not save your selection. Please try again." });
    } finally { setSaving(false); }
  };

  const update = (key: Exclude<keyof OverviewFilters, "columns">, value: string) => setDraft(old => withFilterChange(old, key, value));
  const navigate = (filters: OverviewFilters) => {
    const params = overviewFilterSearchParams(filters, visible);
    startTransition(() => router.push(`${pathname}?${params}`));
  };
  const apply = () => navigate(draft);
  const discardDraft = () => setDraft(report.filters);
  const resetFilters = () => startTransition(() => router.push(pathname));

  const toggleColumn = (key: OverviewColumn, shown: boolean) => {
    if (saving || (!shown && columns.length === 1)) return;
    setSaveStatus(null);
    setColumns(old => shown ? (old.includes(key) ? old : [...old, key]) : old.filter(k => k !== key));
  };
  const changeOrder = (next: OverviewColumn[]) => {
    if (saving) return;
    setSaveStatus(null);
    setColumnOrder(next);
  };

  const applied = report.filters;
  const count = report.rows.length;
  const asOf = formatOverviewDate(applied.asOf) || applied.asOf;

  return (
    <div className={cn(styles.root, "space-y-4")} aria-busy={pending}>
      <OverviewFilterPanel
        draft={draft}
        applied={applied}
        options={report.options}
        pending={pending}
        onChange={update}
        onApply={apply}
        onReset={resetFilters}
        onDiscard={discardDraft}
      />

      <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 pb-3 pt-4 md:px-5">
          <div className="min-w-0 space-y-1">
            <h2 id={headingId} className="text-base font-semibold tracking-tight text-foreground">Campaign financials</h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {count} {count === 1 ? "campaign" : "campaigns"}
              </span>
              <span aria-hidden>·</span>
              <span>
                Amounts in <span className="rounded-md bg-[var(--blue-light)] px-1.5 py-0.5 font-semibold text-[var(--blue-text)]">{applied.currency}</span>, before VAT
              </span>
              <span aria-hidden>·</span>
              <span>Went live as of <span className="font-medium text-foreground">{asOf}</span></span>
              {pending && (
                <>
                  <span aria-hidden>·</span>
                  <span role="status" className="font-medium text-[var(--blue-text)]">Updating…</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OverviewColumnSettings
              order={columnOrder}
              visible={visible}
              saving={saving}
              dirty={selectionChanged}
              status={saveStatus}
              onToggle={toggleColumn}
              onOrderChange={changeOrder}
              onSave={() => void persistSelection()}
              onReset={() => { if (!saving) void persistSelection(true); }}
            />
            <ReportExportActions apiPath="/api/reports/overview/document" fixedParams={{ columns: visible.join(",") }} disabled={pending} />
          </div>
        </header>

        <ul aria-label="Column key" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-3 text-xs text-muted-foreground md:px-5">
          {LEGEND.map(item => (
            <li key={item.kind} className="inline-flex items-center gap-1.5">
              <span className={styles.swatch} data-kind={item.kind} aria-hidden />
              <span><span className="font-medium text-foreground">{item.label}</span> {item.detail}</span>
            </li>
          ))}
        </ul>

        <OverviewReportTable
          rows={report.rows}
          totals={report.totals}
          columns={visible}
          currency={applied.currency}
          pending={pending}
          labelledBy={headingId}
        />

        <footer className="space-y-1 px-4 py-3 text-xs leading-relaxed text-muted-foreground md:px-5">
          <p>
            Actual: went-live activity. Acc.: not yet live. Total = actual + accrued. GP = revenue − cost. Rev. Share = campaign revenue share.
            GP after RS = Total GP − Rev. Share. Totals cover all filtered campaigns.
          </p>
          <p>Dates filter campaign start dates. The as-of date splits current campaign values by publication date; it is not a historical accounting snapshot.</p>
        </footer>
      </section>
    </div>
  );
}
