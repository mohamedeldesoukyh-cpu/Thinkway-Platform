"use client";

import { useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { createForecastVersionAction } from "@/features/planning/actions";
import type { PlanningPermissions } from "@/features/planning/load-planning-workspace";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { ForecastRollupsResult } from "@/lib/planning/queries/load-forecast-rollups";
import type { ForecastVersion } from "@/lib/planning/types/forecast";
import type { BudgetRollupNode } from "@/lib/planning/budgets/budget-rollups";
import { devLog } from "@/lib/platform/logger";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

type ForecastSectionProps = {
  fiscalYear: number;
  forecasts: ForecastVersion[];
  forecastRollups: ForecastRollupsResult | null;
  budgetGlobal: BudgetRollupNode | null;
  permissions: PlanningPermissions;
  selectedForecastId: string | null;
  selectedVersionId: string | null;
};

const FORECAST_VERSION_COLUMNS: OperationalConfigurableColumnDef<ForecastVersion>[] = [
  {
    id: "document",
    label: "Document",
    monoCell: true,
    renderCell: (f) => <DocumentNumber value={f.document_number} />,
  },
  { id: "name", label: "Name", renderCell: (f) => f.name },
  { id: "status", label: "Status", renderCell: (f) => f.status },
  { id: "fiscal_year", label: "FY", renderCell: (f) => f.fiscal_year },
];

const FORECAST_VERSION_COLUMN_METAS = getOperationalTableColumnMetas(FORECAST_VERSION_COLUMNS);

function buildForecastByClientColumns(
  format: (n: number, ctx?: BudgetRollupNode["currency"]) => string
): OperationalConfigurableColumnDef<BudgetRollupNode>[] {
  return [
    { id: "client", label: "Client", renderCell: (node) => node.label },
    {
      id: "forecast",
      label: "Forecast",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (node) => format(node.metrics.revenue_budget, node.currency),
    },
    {
      id: "budget_slice",
      label: "Budget slice",
      headerClassName: "text-right",
      amountCell: true,
      cellClassName: "text-muted-foreground",
      renderCell: () => "Compare via filters",
    },
  ];
}

export function ForecastSection({
  fiscalYear,
  forecasts,
  forecastRollups,
  budgetGlobal,
  permissions,
  selectedForecastId,
  selectedVersionId,
}: ForecastSectionProps) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const global = forecastRollups?.global;
  const clientNodes = forecastRollups?.nodes ?? [];

  const createForecast = () => {
    startTransition(async () => {
      const result = await createForecastVersionAction({
        name: name || `FY${fiscalYear} Rolling forecast`,
        fiscalYear,
        currencyCode: budgetGlobal?.currency.primary_currency ?? "USD",
        budgetVersionId: selectedVersionId ?? undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Forecast version created.");
      setName("");
      if (process.env.NODE_ENV === "development") {
        devLog("[forecast-dashboard] created via UI", result.forecastId);
      }
    });
  };

  const format = (n: number, ctx = global?.currency) =>
    formatAnalyticsAmount(n, ctx ?? {
      primary_currency: "USD",
      is_mixed_currency: false,
      currencies: ["USD"],
      mixed_label: null,
    });

  const forecastByClientColumns = buildForecastByClientColumns(format);
  const forecastByClientColumnMetas = getOperationalTableColumnMetas(forecastByClientColumns);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Forecasting</h3>
          <p className="text-sm text-muted-foreground">
            Rolling forecast vs budget and actual (centralized rollups).
          </p>
        </div>
        {permissions.canForecast ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">New forecast name</Label>
              <Input
                className="h-9 w-48"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rolling forecast"
              />
            </div>
            <Button type="button" size="sm" disabled={isPending} onClick={createForecast}>
              <PlusIcon className="size-4" aria-hidden />
              Create forecast
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Forecast revenue</p>
          <p className="text-lg font-semibold">
            {format(global?.metrics.revenue_budget ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Forecast GP</p>
          <p className="text-lg font-semibold">
            {format(global?.metrics.gp_budget ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Forecast vs budget</p>
          <p className="text-lg font-semibold">
            {format(
              (global?.metrics.revenue_budget ?? 0) -
                (budgetGlobal?.metrics.revenue_budget ?? 0)
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Collections forecast</p>
          <p className="text-lg font-semibold">
            {format(global?.metrics.collections_budget ?? 0)}
          </p>
        </div>
      </div>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.planningForecastVersions}
        columns={FORECAST_VERSION_COLUMNS}
        rows={forecasts}
        filterAccessors={{
          document: (row) => row.document_number,
          name: (row) => row.name,
          status: (row) => row.status,
          fiscal_year: (row) => row.fiscal_year,
        }}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Forecast versions"
              actions={<OperationalTableControlsSlot contextLabel="Forecast versions" />}
            />
          }
        >
          {forecasts.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">No forecast versions yet.</p>
          ) : (
            <OperationalConfigurableTable
              columns={FORECAST_VERSION_COLUMNS}
              rows={forecasts}
              rowKey={(f) => f.id}
              rowClassName={(f) => cn(f.id === selectedForecastId && "bg-muted/40")}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.planningForecastByClient}
        columns={forecastByClientColumns}
        rows={clientNodes.slice(0, 20)}
        filterAccessors={{
          client: (row) => row.label,
          forecast: (row) => row.metrics.revenue_budget,
        }}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="Forecast vs budget (by client)"
              actions={<OperationalTableControlsSlot contextLabel="Forecast by client" />}
            />
          }
        >
          <OperationalConfigurableTable
            columns={forecastByClientColumns}
            rows={clientNodes.slice(0, 20)}
            rowKey={(node) => node.key}
          />
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}
