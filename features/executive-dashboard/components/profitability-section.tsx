"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZIcon, ArrowUpAZIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";
import type { ExecutiveDashboardPayload } from "@/features/analytics/load-executive-dashboard";
import {
  buildProfitabilityTableColumns,
  type ProfitabilitySortKey,
} from "@/lib/tables/profitability-table-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type ProfitabilitySectionProps = {
  tables: ExecutiveDashboardPayload["profitability_tables"];
};

const PROFITABILITY_TABLES = [
  {
    title: "Top clients",
    description: "Highest revenue clients",
    rowsKey: "top_clients" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityClients,
    contextLabel: "Top clients",
    defaultSort: "revenue" as ProfitabilitySortKey,
  },
  {
    title: "Lowest margin clients",
    description: "Clients requiring margin review",
    rowsKey: "lowest_margin_clients" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityLowMarginClients,
    contextLabel: "Low margin clients",
    defaultSort: "margin" as ProfitabilitySortKey,
  },
  {
    title: "Top campaigns",
    description: "Campaign-level revenue leaders",
    rowsKey: "top_campaigns" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityCampaigns,
    contextLabel: "Top campaigns",
    defaultSort: "revenue" as ProfitabilitySortKey,
  },
  {
    title: "Country profitability",
    description: "GP performance by market",
    rowsKey: "country_profitability" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityCountries,
    contextLabel: "Country profitability",
    defaultSort: "gp" as ProfitabilitySortKey,
  },
  {
    title: "Brand profitability",
    description: "Brand-level margin view",
    rowsKey: "brand_profitability" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityBrands,
    contextLabel: "Brand profitability",
    defaultSort: "margin" as ProfitabilitySortKey,
  },
] as const;

function ProfitabilityTable({
  title,
  description,
  rows,
  tableId,
  contextLabel,
  defaultSort,
}: {
  title: string;
  description: string;
  rows: AnalyticsRollupNode[];
  tableId: (typeof OPERATIONAL_TABLE_IDS)[keyof typeof OPERATIONAL_TABLE_IDS];
  contextLabel: string;
  defaultSort: ProfitabilitySortKey;
}) {
  const [sortKey, setSortKey] = useState<ProfitabilitySortKey>(defaultSort);
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "label") {
        return asc ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
      }
      let av = 0;
      let bv = 0;
      if (sortKey === "revenue") {
        av = a.metrics.revenue;
        bv = b.metrics.revenue;
      } else if (sortKey === "gp") {
        av = a.metrics.gp;
        bv = b.metrics.gp;
      } else {
        av = a.metrics.margin_percent;
        bv = b.metrics.margin_percent;
      }
      return asc ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, asc]);

  const toggleSort = (key: ProfitabilitySortKey) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "label");
    }
  };

  const SortHead = ({
    label,
    active,
    asc: sortAsc,
    onClick,
    className,
  }: {
    label: string;
    active: boolean;
    asc: boolean;
    onClick: () => void;
    className?: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-1 inline-flex h-7 px-1.5 text-[10px] font-medium uppercase tracking-wide",
        className
      )}
      onClick={onClick}
    >
      {label}
      {active ? (
        sortAsc ? (
          <ArrowUpAZIcon className="size-3" data-icon="inline-end" />
        ) : (
          <ArrowDownAZIcon className="size-3" data-icon="inline-end" />
        )
      ) : null}
    </Button>
  );

  const columns = useMemo(
    () =>
      buildProfitabilityTableColumns({
        sortKey,
        asc,
        onToggleSort: toggleSort,
        SortHead,
      }),
    [sortKey, asc]
  );

  return (
    <OperationalTableSuiteProvider
      tableId={tableId}
      columns={columns}
      rows={sorted}
      filterAccessors={{
        name: (row) => row.label,
        revenue: (row) => row.metrics.revenue,
        gp: (row) => row.metrics.gp,
        margin: (row) => row.metrics.margin_percent,
      }}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
              <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
            </div>
            <OperationalTableControlsSlot contextLabel={contextLabel} />
          </div>
        }
      >
        <div className="overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11px] text-muted-foreground">
              No rows for current filters
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={sorted}
              rowKey={(row) => `${title}-${row.key}`}
            />
          )}
        </div>
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}

export function ProfitabilitySection({ tables }: ProfitabilitySectionProps) {
  return (
    <section className="space-y-4">
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Profitability analysis
        </h2>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Client, campaign, country, and brand performance — sortable and pagination-ready.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {PROFITABILITY_TABLES.map((config) => (
          <ProfitabilityTable
            key={config.tableId}
            title={config.title}
            description={config.description}
            rows={tables[config.rowsKey]}
            tableId={config.tableId}
            contextLabel={config.contextLabel}
            defaultSort={config.defaultSort}
          />
        ))}
      </div>
    </section>
  );
}
