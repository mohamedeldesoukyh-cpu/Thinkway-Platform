"use client";

import { useMemo, useState } from "react";
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
import type { BudgetVersion } from "@/lib/planning/types/budget";
import { devLog } from "@/lib/platform/logger";

type PlanningWorkspaceViewProps = {
  data: PlanningWorkspacePayload;
};

export function PlanningWorkspaceView({ data }: PlanningWorkspaceViewProps) {
  const tab = data.filterState.tab ?? "dashboard";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"version" | "line">("version");
  const [editVersion, setEditVersion] = useState<BudgetVersion | null>(null);

  const selectedVersion = useMemo(
    () => data.versions.find((v) => v.id === data.selectedVersionId) ?? null,
    [data.versions, data.selectedVersionId]
  );

  if (process.env.NODE_ENV === "development") {
    devLog("[planning-dashboard] render tab", tab);
  }

  return (
    <div className="space-y-6">
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
        <section className="space-y-6">
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
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-semibold">Budget versions</h3>
            {data.permissions.canWrite ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setSheetMode("version");
                  setEditVersion(null);
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
              setEditVersion(v);
              setSheetMode("line");
              setSheetOpen(true);
            }}
            onCreateLine={(v) => {
              setEditVersion(v);
              setSheetMode("line");
              setSheetOpen(true);
            }}
          />
        </section>
      ) : null}

      {tab === "variance" ? (
        <section className="space-y-6">
          <h3 className="font-heading text-lg font-semibold">Budget variance</h3>
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
        <ForecastSection
          fiscalYear={data.fiscalYear}
          forecasts={data.forecasts}
          forecastRollups={data.forecastRollups}
          budgetGlobal={data.budgetRollups?.global ?? null}
          permissions={data.permissions}
          selectedForecastId={data.selectedForecastId}
          selectedVersionId={data.selectedVersionId}
        />
      ) : null}

      {tab === "allocations" ? (
        <AllocationsSection
          allocations={data.allocations}
          permissions={data.permissions}
          currencyCode={selectedVersion?.currency_code}
        />
      ) : null}

      <BudgetCreateSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        fiscalYear={data.fiscalYear}
        filterOptions={data.filterOptions}
        version={editVersion ?? selectedVersion}
      />
    </div>
  );
}
