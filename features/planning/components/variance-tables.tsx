"use client";

import {
  OperationalConfigurableTable,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";
import {
  buildVarianceTableColumns,
  type VarianceMetric,
} from "@/lib/tables/variance-table-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

type VarianceTablesProps = {
  topPositive: VarianceAnalysis[];
  topNegative: VarianceAnalysis[];
  clientVariance: VarianceAnalysis[];
  brandVariance: VarianceAnalysis[];
  countryVariance: VarianceAnalysis[];
  global: VarianceAnalysis | null;
};

const VARIANCE_TABLE_CONFIG = [
  {
    title: "Largest positive variance",
    tableId: OPERATIONAL_TABLE_IDS.planningVariancePositive,
    contextLabel: "Positive variance",
  },
  {
    title: "Largest negative variance",
    tableId: OPERATIONAL_TABLE_IDS.planningVarianceNegative,
    contextLabel: "Negative variance",
  },
  {
    title: "Client variance",
    tableId: OPERATIONAL_TABLE_IDS.planningVarianceClient,
    contextLabel: "Client variance",
  },
  {
    title: "Brand variance",
    tableId: OPERATIONAL_TABLE_IDS.planningVarianceBrand,
    contextLabel: "Brand variance",
  },
  {
    title: "Country variance",
    tableId: OPERATIONAL_TABLE_IDS.planningVarianceCountry,
    contextLabel: "Country variance",
  },
] as const;

function VarianceTable({
  title,
  tableId,
  contextLabel,
  rows,
  metric = "revenue",
}: {
  title: string;
  tableId: (typeof OPERATIONAL_TABLE_IDS)[keyof typeof OPERATIONAL_TABLE_IDS];
  contextLabel: string;
  rows: VarianceAnalysis[];
  metric?: VarianceMetric;
}) {
  const columns = buildVarianceTableColumns(metric);

  return (
    <OperationalTableSuiteProvider
      tableId={tableId}
      columns={columns}
      rows={rows}
      filterAccessors={{
        entity: (row) => row.label,
        budget: (row) => row.budget[`${metric}_budget` as keyof typeof row.budget],
        actual: (row) => row.actual[metric as keyof typeof row.actual],
        variance: (row) => row.variance_amount[metric as keyof typeof row.variance_amount],
        percent: (row) => row.variance_percent[metric as keyof typeof row.variance_percent],
      }}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title={title}
            actions={<OperationalTableControlsSlot contextLabel={contextLabel} />}
          />
        }
      >
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">No variance data.</p>
        ) : (
          <OperationalConfigurableTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.key}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}

export function VarianceTables({
  topPositive,
  topNegative,
  clientVariance,
  brandVariance,
  countryVariance,
  global,
}: VarianceTablesProps) {
  const rowSets = [
    topPositive,
    topNegative,
    clientVariance,
    brandVariance,
    countryVariance,
  ];

  return (
    <div className="space-y-4">
      {global ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Budget vs actual</p>
            <p className="text-sm font-medium">
              Revenue variance{" "}
              <span
                className={cn(
                  global.variance_amount.revenue >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                )}
              >
                {formatAnalyticsAmount(
                  global.variance_amount.revenue,
                  global.currency
                )}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GP variance</p>
            <p className="text-sm font-medium">
              {formatAnalyticsAmount(global.variance_amount.gp, global.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collections variance</p>
            <p className="text-sm font-medium">
              {formatAnalyticsAmount(
                global.variance_amount.collections,
                global.currency
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {VARIANCE_TABLE_CONFIG.map((config, index) => (
          <VarianceTable
            key={config.tableId}
            title={config.title}
            tableId={config.tableId}
            contextLabel={config.contextLabel}
            rows={rowSets[index] ?? []}
          />
        ))}
      </div>
    </div>
  );
}
