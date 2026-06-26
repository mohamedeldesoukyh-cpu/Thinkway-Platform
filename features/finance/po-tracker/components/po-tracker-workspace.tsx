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
        <span className="tabular-nums">{row.po_number ?? "—"}</span>
      </div>
    ),
  },
  { id: "client", label: "Client", renderCell: (row) => row.client_name },
  { id: "brand", label: "Brand", renderCell: (row) => row.brand_name },
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
    renderCell: (row) => row.po_currency ?? row.campaign_currency,
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
    renderCell: (row) => formatMoney(row.po_remaining_amount, row.campaign_currency),
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total PO (converted)"
          value={formatMoney(data.summary.total_po_amount, "USD")}
        />
        <KpiCard
          title="Consumed"
          value={formatMoney(data.summary.total_consumed, "USD")}
        />
        <KpiCard
          title="Remaining"
          value={formatMoney(data.summary.total_remaining, "USD")}
        />
        <KpiCard
          title="Over-consumed"
          value={String(data.summary.over_consumed_count)}
          alert={data.summary.over_consumed_count > 0}
        />
      </div>

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
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No PO records match these filters.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={PO_TRACKER_COLUMNS}
              rows={data.rows}
              rowKey={(row) => row.campaign_id}
            />
          )}
        </OperationalTableSection>
      </OperationalTableSuiteProvider>
    </div>
  );
}

function KpiCard({
  title,
  value,
  alert,
}: {
  title: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <CampaignFlatSection
      title={title}
      className={cn(alert ? "border-destructive/40" : undefined)}
    >
      <p className={cn("text-2xl font-semibold", alert && "text-destructive")}>
        {value}
      </p>
    </CampaignFlatSection>
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
