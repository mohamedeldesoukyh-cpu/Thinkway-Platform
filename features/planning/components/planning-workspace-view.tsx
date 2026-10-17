"use client";

import { useMemo, useState } from "react";
import { BillingStyleKpis } from "@/components/finance/billing-style-surfaces";
import { PlusIcon } from "lucide-react";

import { PlanningChartsGrid } from "@/components/planning/charts/planning-charts-grid";
import { Button } from "@/components/ui/button";
import { BudgetCreateSheet } from "@/features/planning/components/budget-create-sheet";
import { BudgetDrilldownTree } from "@/features/planning/components/budget-drilldown-tree";
import { BudgetVersionsTable } from "@/features/planning/components/budget-versions-table";
import { AllocationsSection } from "@/features/planning/components/allocations-section";
import { ForecastSection } from "@/features/planning/components/forecast-section";
import { PlanningFilterBar } from "@/features/planning/components/planning-filter-bar";
import { PlanningKpiStrip } from "@/features/planning/components/planning-kpi-strip";
import { VarianceTables } from "@/features/planning/components/variance-tables";
import type { PlanningWorkspacePayload } from "@/features/planning/load-planning-workspace";
import type { BudgetVersion, BudgetLine } from "@/lib/planning/types/budget";
import { MonthlyBudgetProgress } from "@/features/planning/components/monthly-budget-progress";
import { budgetVersionAllowsLineWrite } from "@/lib/planning/budgets/budget-status";
import { devLog } from "@/lib/platform/logger";

type PlanningWorkspaceViewProps = {
  data: PlanningWorkspacePayload;
};

export function PlanningWorkspaceView({ data }: PlanningWorkspaceViewProps) {
  const tab = data.filterState.tab ?? "dashboard";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"version" | "line">("version");
  const [editVersion, setEditVersion] = useState<BudgetVersion | null>(null);
  const [editLine, setEditLine] = useState<BudgetLine | null>(null);

  const selectedVersion = useMemo(
    () => data.versions.find((v) => v.id === data.selectedVersionId) ?? null,
    [data.versions, data.selectedVersionId]
  );

  if (process.env.NODE_ENV === "development") {
    devLog("[planning-dashboard] render tab", tab);
  }

  return (
    <div className="space-y-6">
      <BillingStyleKpis items={[
        { id: "year", label: "Fiscal year", value: String(data.fiscalYear), hint: "Current planning period" },
        { id: "versions", label: "Budget versions", value: String(data.versions.length), hint: "Available for the selected year" },
        { id: "forecasts", label: "Forecast versions", value: String(data.forecasts.length), hint: "Available in this workspace" },
        { id: "selected", label: "Selected budget", value: selectedVersion?.name ?? "Not selected", hint: selectedVersion?.status ?? "Create or approve a budget version" },
      ]} />
      <PlanningFilterBar
        options={data.filterOptions}
        versions={data.versions}
        forecasts={data.forecasts}
        fiscalYear={data.fiscalYear}
      />

      {data.queryWarnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Some planning data is unavailable: {data.queryWarnings.join(" · ")}
        </div>
      ) : null}

      {tab === "dashboard" ? (
        <section className="related-inner-panel space-y-6">
          <MonthlyBudgetProgress rows={data.dashboard.monthly} currency={selectedVersion?.currency_code ?? "EGP"} unallocated={data.dashboard.unallocatedLineCount} />
          <PlanningKpiStrip
            cards={data.dashboard.kpis}
            currency={data.dashboard.currency}
          />
          <PlanningChartsGrid charts={data.dashboard.charts} mode="dashboard" />
          <div>
            <h3 className="mb-3 font-heading text-lg font-semibold">Budget drilldown</h3>
            <BudgetDrilldownTree
              rollups={data.dashboard.drilldown_rollups}
              variances={data.dashboard.client_variance}
            />
          </div>
        </section>
      ) : null}

      {tab === "versions" ? (
        <section className="related-inner-panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-semibold">Budget versions</h3>
            {data.permissions.canWrite ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setSheetMode("version");
                  setEditVersion(null);
                  setEditLine(null);
                  setSheetOpen(true);
                }}
              >
                <PlusIcon className="size-4" aria-hidden />
                New version
              </Button>
            ) : null}
          </div>
          <BudgetVersionsTable
            versions={data.versions}
            permissions={data.permissions}
            selectedVersionId={data.selectedVersionId}
            onEdit={(v) => {
              setEditLine(null);
              setEditVersion(v);
              setSheetMode("line");
              setSheetOpen(true);
            }}
            onCreateLine={(v) => {
              setEditLine(null);
              setEditVersion(v);
              setSheetMode("line");
              setSheetOpen(true);
            }}
          />
          {selectedVersion ? <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Budget entries · {selectedVersion.name}</h3><p className="text-sm text-muted-foreground">Add a revenue and cost line for each month. Select a budget version above to review its entries.</p></div>
              {data.permissions.canWrite && budgetVersionAllowsLineWrite(selectedVersion.status) ? <Button onClick={() => { setEditVersion(selectedVersion); setEditLine(null); setSheetMode("line"); setSheetOpen(true); }}>Add monthly entry</Button> : <p className="text-sm text-muted-foreground">This budget is read-only.</p>}
            </div>
            {data.lines.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No entries yet. Add January revenue and cost to begin.</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b">{["Period", "Label / client", "Revenue", "Cost", "Gross profit", ""].map((h, i) => <th key={i} className="px-3 py-3 text-left" scope="col">{h}</th>)}</tr></thead><tbody>{data.lines.map(line => <tr key={line.id} className="border-b last:border-0">
              <td className="px-3 py-3">{data.periodsByVersion[selectedVersion.id]?.find(p => p.id === line.budget_period_id)?.period_key ?? "Not allocated"}</td>
              <td className="px-3 py-3">{line.line_label || data.filterOptions.clients.find(c => c.id === line.client_id)?.name || "Company-wide"}</td>
              {[line.revenue_budget, line.cost_budget, line.revenue_budget - line.cost_budget].map((n, i) => <td key={i} className="px-3 py-3 tabular-nums">{n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {line.currency_code}</td>)}
              <td className="px-3 py-3">{data.permissions.canWrite && budgetVersionAllowsLineWrite(selectedVersion.status) ? <Button size="sm" variant="outline" onClick={() => { setEditVersion(selectedVersion); setEditLine(line); setSheetMode("line"); setSheetOpen(true); }}>Edit</Button> : null}</td>
            </tr>)}</tbody></table></div>}
          </div> : null}
        </section>
      ) : null}

      {tab === "variance" ? (
        <section className="related-inner-panel space-y-6">
          <h3 className="font-heading text-lg font-semibold">Budget variance</h3>
          <MonthlyBudgetProgress rows={data.dashboard.monthly} currency={selectedVersion?.currency_code ?? "EGP"} unallocated={data.dashboard.unallocatedLineCount} />
          <PlanningChartsGrid charts={data.dashboard.charts} mode="variance" />
          <VarianceTables
            topPositive={data.dashboard.top_positive}
            topNegative={data.dashboard.top_negative}
            clientVariance={data.dashboard.client_variance}
            brandVariance={data.dashboard.brand_variance}
            countryVariance={data.dashboard.country_variance}
            global={data.dashboard.global_variance}
          />
        </section>
      ) : null}

      {tab === "forecasting" ? (
        <section className="related-inner-panel">
        <ForecastSection
          fiscalYear={data.fiscalYear}
          forecasts={data.forecasts}
          forecastRollups={data.forecastRollups}
          budgetGlobal={data.budgetRollups?.global ?? null}
          permissions={data.permissions}
          selectedForecastId={data.selectedForecastId}
          selectedVersionId={data.selectedVersionId}
        />
        </section>
      ) : null}

      {tab === "allocations" ? (
        <section className="related-inner-panel">
        <AllocationsSection
          allocations={data.allocations}
          permissions={data.permissions}
          currencyCode={selectedVersion?.currency_code}
        />
        </section>
      ) : null}

      <BudgetCreateSheet
        key={`${sheetOpen}-${sheetMode}-${editVersion?.id}-${editLine?.id}`}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        fiscalYear={data.fiscalYear}
        filterOptions={data.filterOptions}
        version={editVersion ?? selectedVersion}
        periods={data.periodsByVersion[(editVersion ?? selectedVersion)?.id ?? ""] ?? []}
        line={editLine}
      />
    </div>
  );
}
