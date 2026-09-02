"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Badge } from "@/components/ui/badge";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { FinanceSuiteEmpty, FinanceSuiteKpiStrip } from "@/components/finance/suite";
import { cn } from "@/lib/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { Label } from "@/components/ui/label";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
} from "@/lib/finance/po/status";
import { formatMoney } from "@/features/campaigns/utils";
import type { PoTrackerWorkspaceData } from "@/features/finance/po-tracker/types";
import { buildGroupFilterSelectOptions } from "@/lib/groups/group-filter";

const NONE = "__all__";

type PoRow = PoTrackerWorkspaceData["rows"][number];

const PO_TRACKER_COLUMNS: OperationalConfigurableColumnDef<PoRow>[] = [
  {
    id: "po_number",
    label: "PO #",
    monoCell: true,
    renderCell: (row) => (
      <div className="flex items-center gap-2">
        {row.is_over_consumed ? (
          <AlertTriangleIcon className="size-4 text-destructive" />
        ) : null}
        <span className={row.po_number ? "fs-id" : "fs-miss"}>
          {row.po_number ?? "not set"}
        </span>
      </div>
    ),
  },
  { id: "client", label: "Client", renderCell: (row) => <span className="fs-t">{row.client_name}</span> },
  { id: "brand", label: "Brand", renderCell: (row) => <span className="fs-br">{row.brand_name}</span> },
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => (
      <Link
        href={`/campaigns/${row.campaign_id}`}
        className="font-medium hover:underline"
      >
        {row.campaign_name}
      </Link>
    ),
  },
  {
    id: "currency",
    label: "Currency",
    renderCell: (row) => (
      <span className="fs-cc">{row.po_currency ?? row.campaign_currency}</span>
    ),
  },
  {
    id: "original_po",
    label: "Original PO",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) =>
      formatMoney(row.po_amount_original, row.po_currency ?? row.campaign_currency),
  },
  {
    id: "converted_po",
    label: "Converted PO",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) =>
      formatMoney(row.po_amount_campaign_currency, row.campaign_currency),
  },
  {
    id: "consumed",
    label: "Consumed",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => formatMoney(row.po_consumed_amount, row.campaign_currency),
  },
  {
    id: "remaining",
    label: "Remaining",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => {
      const converted = row.po_amount_campaign_currency;
      const remaining = row.po_remaining_amount;
      const consumedPct =
        converted > 0
          ? Math.min(100, (row.po_consumed_amount / converted) * 100)
          : remaining < 0
            ? 100
            : 0;
      const tight =
        !row.is_over_consumed &&
        remaining >= 0 &&
        remaining < 1 &&
        converted > 0;
      return (
        <div>
          <span className={cn("fs-v", remaining < 0 && "neg", remaining > 1 && "pos")}>
            {formatMoney(remaining, row.campaign_currency)}
          </span>
          <span className="fs-bar">
            <i
              className={remaining < 0 ? "r" : tight ? "y" : undefined}
              style={{ width: `${consumedPct}%` }}
            />
          </span>
        </div>
      );
    },
  },
  {
    id: "remaining_percent",
    label: "Remaining %",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) =>
      row.po_remaining_percent != null ? `${row.po_remaining_percent.toFixed(1)}%` : "—",
  },
  {
    id: "status",
    label: "Status",
    renderCell: (row) => (
      <Badge variant={PO_STATUS_VARIANT[row.po_status]}>
        {PO_STATUS_LABELS[row.po_status]}
      </Badge>
    ),
  },
  { id: "expiry", label: "Expiry", renderCell: (row) => row.po_expiry_date ?? "—" },
  {
    id: "fx",
    label: "FX",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (row) => row.po_exchange_rate?.toFixed(4) ?? "—",
  },
];

const PO_TRACKER_COLUMN_METAS = getOperationalTableColumnMetas(PO_TRACKER_COLUMNS);

type PoTrackerWorkspaceProps = {
  data: PoTrackerWorkspaceData;
};

export function PoTrackerWorkspace({ data }: PoTrackerWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === NONE) params.delete(key);
    else params.set(key, value);
    router.push(`/finance/po-tracker?${params.toString()}`);
  }

  const missingPoCount = data.rows.filter((row) => !row.po_number).length;
  const currencies = new Set(
    data.rows.map((row) => row.po_currency ?? row.campaign_currency)
  );

  return (
    <div className="space-y-4">
      <FinanceSuiteKpiStrip
        items={[
          {
            id: "orders",
            label: "Purchase orders",
            value: String(data.rows.length),
            hint: `across ${currencies.size} currenc${currencies.size === 1 ? "y" : "ies"}`,
          },
          {
            id: "total",
            label: "Total PO (converted)",
            value: formatMoney(data.summary.total_po_amount, "USD"),
            hint: "Campaign-currency converted",
          },
          {
            id: "consumed",
            label: "Consumed",
            value: formatMoney(data.summary.total_consumed, "USD"),
          },
          {
            id: "remaining",
            label: "Remaining",
            value: formatMoney(data.summary.total_remaining, "USD"),
            hint: `${data.summary.near_limit_count} near limit`,
          },
          {
            id: "missing",
            label: "Without a PO number",
            value: String(missingPoCount),
            hint: "consuming budget anyway",
            tone: missingPoCount > 0 ? "bad" : undefined,
          },
          {
            id: "over",
            label: "Over-consumed",
            value: String(data.summary.over_consumed_count),
            hint: "consumed exceeds PO value",
            tone: data.summary.over_consumed_count > 0 ? "bad" : undefined,
          },
        ]}
      />

      <CampaignFlatSection title="Filters">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Group"
            value={searchParams.get("group_id") ?? NONE}
            onChange={(v) => setFilter("group_id", v)}
            options={buildGroupFilterSelectOptions(data.filter_options.groups).map(
              (option) => ({
                value: option.value || NONE,
                label: option.label,
              })
            )}
          />
          <FilterSelect
            label="Client"
            value={searchParams.get("client_id") ?? NONE}
            onChange={(v) => setFilter("client_id", v)}
            options={data.filter_options.clients.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
          <FilterSelect
            label="Brand"
            value={searchParams.get("brand_id") ?? NONE}
            onChange={(v) => setFilter("brand_id", v)}
            options={data.filter_options.brands.map((b) => ({
              value: b.id,
              label: b.name,
            }))}
          />
          <FilterSelect
            label="Campaign"
            value={searchParams.get("campaign_id") ?? NONE}
            onChange={(v) => setFilter("campaign_id", v)}
            options={data.filter_options.campaigns.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
          />
          <FilterSelect
            label="PO currency"
            value={searchParams.get("currency") ?? NONE}
            onChange={(v) => setFilter("currency", v)}
            options={data.filter_options.currencies.map((c) => ({
              value: c.code,
              label: c.code,
            }))}
          />
          <FilterSelect
            label="PO status"
            value={searchParams.get("po_status") ?? NONE}
            onChange={(v) => setFilter("po_status", v)}
            options={Object.entries(PO_STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <div className="grid gap-2">
            <Label>Over-consumed only</Label>
            <Select
              value={searchParams.get("over_consumed") ?? "0"}
              onValueChange={(v) => setFilter("over_consumed", v === "1" ? "1" : "")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All campaigns</SelectItem>
                <SelectItem value="1">Over-consumed only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Expiring soon</Label>
            <Select
              value={searchParams.get("expiring_soon") ?? "0"}
              onValueChange={(v) => setFilter("expiring_soon", v === "1" ? "1" : "")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any expiry</SelectItem>
                <SelectItem value="1">Within 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CampaignFlatSection>

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.financePoTracker}
        columns={PO_TRACKER_COLUMNS}
        rows={data.rows}
        filterAccessors={{
          po_number: (row) => row.po_number,
          client: (row) => row.client_name,
          brand: (row) => row.brand_name,
          campaign: (row) => row.campaign_name,
          currency: (row) => row.po_currency ?? row.campaign_currency,
          original_po: (row) => row.po_amount_original,
          converted_po: (row) => row.po_amount_campaign_currency,
          consumed: (row) => row.po_consumed_amount,
          remaining: (row) => row.po_remaining_amount,
          remaining_percent: (row) => row.po_remaining_percent,
          status: (row) => row.po_status,
          expiry: (row) => row.po_expiry_date,
          fx: (row) => row.po_exchange_rate,
        }}
      >
        <OperationalTableSection
          wide
          tableOnly
          cardSurface
          leading={
            <CampaignOperationalSectionHeader
              title="PO tracker"
              actions={<OperationalTableControlsSlot contextLabel="PO tracker" />}
            />
          }
        >
          {data.rows.length === 0 ? (
            <FinanceSuiteEmpty
              title="No PO records match these filters"
              body="Adjust group, client, brand, or status filters to see purchase-order consumption."
            />
          ) : (
            <OperationalConfigurableTable
              columns={PO_TRACKER_COLUMNS}
              rows={data.rows}
              rowKey={(row) => row.campaign_id}
              rowClassName={(row) =>
                row.is_over_consumed
                  ? "fs-row-bad"
                  : row.po_status === "near_limit"
                    ? "fs-row-warn"
                    : undefined
              }
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
