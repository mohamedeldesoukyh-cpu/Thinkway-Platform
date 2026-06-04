"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZIcon, ArrowUpAZIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";
import type { ExecutiveDashboardPayload } from "@/features/analytics/load-executive-dashboard";
type SortKey = "label" | "revenue" | "gp" | "margin";

type ProfitabilitySectionProps = {
  tables: ExecutiveDashboardPayload["profitability_tables"];
};

function ProfitabilityTable({
  title,
  description,
  rows,
  defaultSort,
}: {
  title: string;
  description: string;
  rows: AnalyticsRollupNode[];
  defaultSort: SortKey;
}) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "label");
    }
  };

  const formatAmount = (node: AnalyticsRollupNode, value: number) =>
    formatAnalyticsAmount(value, node.currency, { decimals: 0 });

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <CampaignOperationalTable>
          <CampaignOperationalTableHeader>
            <CampaignOperationalTableHeaderRow>
              <SortHead
                label="Name"
                active={sortKey === "label"}
                asc={asc}
                onClick={() => toggleSort("label")}
              />
              <SortHead
                label="Revenue"
                active={sortKey === "revenue"}
                asc={asc}
                onClick={() => toggleSort("revenue")}
                className="text-right"
              />
              <SortHead
                label="GP"
                active={sortKey === "gp"}
                asc={asc}
                onClick={() => toggleSort("gp")}
                className="text-right"
              />
              <SortHead
                label="Margin"
                active={sortKey === "margin"}
                asc={asc}
                onClick={() => toggleSort("margin")}
                className="text-right"
              />
            </CampaignOperationalTableHeaderRow>
          </CampaignOperationalTableHeader>
          <CampaignOperationalTableBody>
            {sorted.length === 0 ? (
              <CampaignOperationalTableRow>
                <CampaignOperationalTableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No rows for current filters
                </CampaignOperationalTableCell>
              </CampaignOperationalTableRow>
            ) : (
              sorted.map((row) => (
                <CampaignOperationalTableRow key={`${title}-${row.key}`}>
                  <CampaignOperationalTableCell className="max-w-[200px] truncate font-medium text-foreground">
                    {row.label}
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCellAmount>
                    {formatAmount(row, row.metrics.revenue)}
                  </CampaignOperationalTableCellAmount>
                  <CampaignOperationalTableCellAmount>
                    {formatAmount(row, row.metrics.gp)}
                  </CampaignOperationalTableCellAmount>
                  <CampaignOperationalTableCellAmount>
                    {row.metrics.margin_percent.toFixed(1)}%
                  </CampaignOperationalTableCellAmount>
                </CampaignOperationalTableRow>
              ))
            )}
          </CampaignOperationalTableBody>
        </CampaignOperationalTable>
      </div>
    </OperationalTableSection>
  );
}

function SortHead({
  label,
  active,
  asc,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <CampaignOperationalTableHead className={className}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-1 h-7 px-1.5 text-[10px] font-medium uppercase tracking-wide"
        onClick={onClick}
      >
        {label}
        {active ? (
          asc ? (
            <ArrowUpAZIcon className="size-3" data-icon="inline-end" />
          ) : (
            <ArrowDownAZIcon className="size-3" data-icon="inline-end" />
          )
        ) : null}
      </Button>
    </CampaignOperationalTableHead>
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
        <ProfitabilityTable
          title="Top clients"
          description="Highest revenue clients"
          rows={tables.top_clients}
          defaultSort="revenue"
        />
        <ProfitabilityTable
          title="Lowest margin clients"
          description="Clients requiring margin review"
          rows={tables.lowest_margin_clients}
          defaultSort="margin"
        />
        <ProfitabilityTable
          title="Top campaigns"
          description="Campaign-level revenue leaders"
          rows={tables.top_campaigns}
          defaultSort="revenue"
        />
        <ProfitabilityTable
          title="Country profitability"
          description="GP performance by market"
          rows={tables.country_profitability}
          defaultSort="gp"
        />
        <ProfitabilityTable
          title="Brand profitability"
          description="Brand-level margin view"
          rows={tables.brand_profitability}
          defaultSort="margin"
        />
      </div>
    </section>
  );
}
