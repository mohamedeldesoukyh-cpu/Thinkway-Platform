"use client";

import Link from "next/link";
import { useState } from "react";
import { PoDetailsPane } from "./po-details-pane";
import { useRouter, useSearchParams } from "next/navigation";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BillingStyleCard as FinanceSuiteCard, BillingStyleKpis as FinanceSuiteKpiStrip } from "@/components/finance/billing-style-surfaces";
import { FinanceSuiteEmpty } from "@/components/finance/suite";
import { cn } from "@/lib/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";


import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
} from "@/lib/finance/po/status";
import { formatMoney } from "@/features/campaigns/utils";
import type { PoTrackerWorkspaceData } from "@/features/finance/po-tracker/types";
import { buildGroupFilterSelectOptions, matchesGroupFilter } from "@/lib/groups/group-filter";

const NONE = "__all__";

type PoRow = PoTrackerWorkspaceData["rows"][number];

const PO_TRACKER_COLUMNS: OperationalConfigurableColumnDef<PoRow>[] = [
  {
    id: "po_number",
    label: "PO #",
    monoCell: true,
    renderCell: (row) => (
      <span className={row.po_number ? "tw-id" : "tw-miss"}>
        {row.po_number ?? "not set"}
      </span>
    ),
  },
  { id: "client", label: "Client", renderCell: (row) => <span className="tw-t">{row.client_name}</span> },
  { id: "brand", label: "Brand", renderCell: (row) => <span className="tw-br">{row.brand_name}</span> },
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (row) => (
      <Link
        href={`/campaigns/${row.campaign_id}`}
        className="tw-nm hover:underline"
      >
        {row.campaign_name}
      </Link>
    ),
  },
  {
    id: "currency",
    label: "Ccy",
    renderCell: (row) => (
      <span className="tw-cc">{row.po_currency ?? row.campaign_currency}</span>
    ),
  },
  {
    id: "original_po",
    label: "Original PO",
    headerClassName: "!text-left",
    cellClassName: "!text-left whitespace-nowrap",
    amountCell: true,
    renderCell: (row) =>
      formatMoney(row.po_amount_original, row.po_currency ?? row.campaign_currency),
  },
  {
    id: "converted_po",
    label: "PO / campaign budget",
    headerClassName: "!text-left",
    cellClassName: "!text-left whitespace-nowrap",
    amountCell: true,
    renderCell: (row) =>
      formatMoney(row.po_amount_campaign_currency, row.campaign_currency),
  },
  {
    id: "consumed",
    label: "Consumed",
    headerClassName: "!text-left",
    cellClassName: "!text-left whitespace-nowrap",
    amountCell: true,
    renderCell: (row) => formatMoney(row.po_consumed_amount, row.campaign_currency),
  },
  {
    id: "remaining",
    label: "Remaining",
    headerClassName: "!text-left",
    cellClassName: "!text-left whitespace-nowrap",
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
          <span className={cn("tw-v", remaining < 0 && "neg", remaining > 1 && "pos")}>
            {formatMoney(remaining, row.campaign_currency)}
          </span>
          <span className="tw-bar">
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
    headerClassName: "!text-left",
    cellClassName: "!text-left whitespace-nowrap",
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
    headerClassName: "!text-left",
    cellClassName: "!text-left whitespace-nowrap",
    amountCell: true,
    renderCell: (row) => row.po_exchange_rate?.toFixed(4) ?? "—",
  },
];

type PoTrackerWorkspaceProps = {
  data: PoTrackerWorkspaceData;
};

export function PoTrackerWorkspace({ data }: PoTrackerWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<PoRow | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [paneHeight, setPaneHeight] = useState(44);
  const activeRow = data.rows.find(row => row.campaign_id === selected?.campaign_id) ?? selected;
  function selectPo(row: PoRow | null) {
    if (saving || row?.campaign_id === selected?.campaign_id) return;
    if (dirty && !window.confirm("Discard unsaved PO changes?")) return;
    setDirty(false);
    setSelected(row);
  }
  const columns = PO_TRACKER_COLUMNS.map(column => column.id === "po_number" ? {
    ...column,
    locked: true,
    renderCell: (row: PoRow) => <button type="button" className="po-select-link" aria-label={`Open PO ${row.po_number || "not assigned"} for ${row.campaign_name}`} aria-pressed={row.campaign_id === selected?.campaign_id} onClick={() => selectPo(row)}>{row.po_number || "Add PO details"}</button>,
  } : column.amountCell ? {
    ...column,
    renderCell: (row: PoRow) => <button type="button" className="po-amount-link" aria-label={`Open ${column.label} details for ${row.campaign_name}`} onClick={() => selectPo(row)}>{column.renderCell(row)}</button>,
  } : column);
  const needle = search.trim().toLocaleLowerCase();
  const rows = data.rows.filter(row => [row.po_number, row.campaign_name, row.client_name, row.brand_name, row.campaign_document_number].some(value => value?.toLocaleLowerCase().includes(needle)));
  const advancedCount = ["campaign_id", "currency", "po_status", "over_consumed", "expiring_soon"].filter(key => searchParams.has(key)).length;
  const clients = data.filter_options.clients.filter(client => matchesGroupFilter(client.group_id, searchParams.get("group_id")));
  const clientIds = new Set(clients.map(client => client.id));
  const brands = data.filter_options.brands.filter(brand => searchParams.get("client_id") ? brand.client_id === searchParams.get("client_id") : clientIds.has(brand.client_id));

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "group_id") { params.delete("client_id"); params.delete("brand_id"); params.delete("campaign_id"); }
    if (key === "client_id") { params.delete("brand_id"); params.delete("campaign_id"); }
    if (key === "brand_id") params.delete("campaign_id");
    if (!value || value === NONE) params.delete(key);
    else params.set(key, value);
    router.push(`/finance/po-tracker?${params.toString()}`);
  }

  const missingPoCount = data.rows.filter((row) => !row.po_number).length;
  const currencies = new Set(
    data.rows.map((row) => row.po_currency ?? row.campaign_currency)
  );

  return (
    <div className={cn("po-tracker-workspace", activeRow && "po-has-details")}>
      <FinanceSuiteKpiStrip
        items={[
          {
            id: "orders",
            label: "Campaigns tracked",
            value: String(data.rows.length),
            hint: `across ${currencies.size} currenc${currencies.size === 1 ? "y" : "ies"}`,
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
          {
            id: "limit",
            label: "At limit",
            value: String(data.summary.near_limit_count),
            hint: "remaining under 1 unit",
          },
        ]}
      />

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.financePoTracker}
        columns={columns}
        rows={rows}
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
        <FinanceSuiteCard
          title="Purchase orders"
          subtitle="Campaign budgets and PO consumption · amounts retain their currencies"
          actions={<><Button type="button" variant="outline" size="sm" onClick={() => { setSearch(""); router.push('/finance/po-tracker'); }}>Reset filters</Button><OperationalTableControlsSlot contextLabel="Purchase orders" /></>}
        >
          <div className="po-filter-bar">
            <label className="po-field po-search">Search POs<input className="po-control" type="search" placeholder="PO, client, brand or campaign" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <FilterSelect label="Group" value={searchParams.get("group_id") ?? NONE} onChange={value => setFilter("group_id", value)} options={buildGroupFilterSelectOptions(data.filter_options.groups).map(option => ({ value: option.value || NONE, label: option.label }))} />
            <FilterSelect label="Client" value={searchParams.get("client_id") ?? NONE} onChange={value => setFilter("client_id", value)} options={clients.map(client => ({ value: client.id, label: client.name }))} />
            <FilterSelect label="Brand" value={searchParams.get("brand_id") ?? NONE} onChange={value => setFilter("brand_id", value)} options={brands.map(brand => ({ value: brand.id, label: brand.name }))} />
            <Button type="button" size="sm" variant="outline" aria-expanded={moreFilters} aria-controls="po-extra-filters" onClick={() => setMoreFilters(!moreFilters)}>More filters{advancedCount > 0 ? ` (${advancedCount})` : ""}</Button>
          </div>
          {moreFilters && <div className="po-filter-bar po-extra-filters" id="po-extra-filters">
            <FilterSelect label="Campaign" value={searchParams.get("campaign_id") ?? NONE} onChange={value => setFilter("campaign_id", value)} options={data.filter_options.campaigns.filter(campaign => searchParams.get("brand_id") ? campaign.brand_id === searchParams.get("brand_id") : brands.some(brand => brand.id === campaign.brand_id)).map(campaign => ({ value: campaign.id, label: campaign.name }))} />
            <FilterSelect label="Currency" value={searchParams.get("currency") ?? NONE} onChange={value => setFilter("currency", value)} options={data.filter_options.currencies.map(currency => ({ value: currency.code, label: currency.code }))} />
            <FilterSelect label="Status" value={searchParams.get("po_status") ?? NONE} onChange={value => setFilter("po_status", value)} options={Object.entries(PO_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
            <label className="po-check"><input type="checkbox" checked={searchParams.get("over_consumed") === "1"} onChange={event => setFilter("over_consumed", event.target.checked ? "1" : "")} />Over-consumed only</label>
            <label className="po-check"><input type="checkbox" checked={searchParams.get("expiring_soon") === "1"} onChange={event => setFilter("expiring_soon", event.target.checked ? "1" : "")} />Expires within 30 days</label>
          </div>}
          <div className="po-list-scroll" aria-label="PO lines">
          {rows.length === 0 ? (
            <FinanceSuiteEmpty
              title="No PO records match these filters"
              body="Adjust group, client, brand, or status filters to see purchase-order consumption."
            />
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.campaign_id}
              rowClassName={(row) => row.campaign_id === selected?.campaign_id ? "po-selected-row" :
                row.is_over_consumed
                  ? "fs-row-bad"
                  : row.po_status === "near_limit"
                    ? "fs-row-warn"
                    : undefined
              }
            />
          )}
          </div>
        </FinanceSuiteCard>
      </OperationalTableSuiteProvider>
      {activeRow && <PoDetailsPane key={activeRow.campaign_id} row={activeRow} currencies={data.filter_options.currencies} canEdit={data.can_edit} height={paneHeight} onResize={setPaneHeight} onClose={() => selectPo(null)} onDirtyChange={setDirty} onPendingChange={setSaving} />}
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
  return <label className="po-field">{label}
    <select className="po-control" value={value} onChange={event => onChange(event.target.value)}>
      <option value={NONE}>{label === "Currency" ? "All currencies" : label === "Status" ? "All statuses" : `All ${label.toLowerCase()}s`}</option>
      {options.filter(option => option.value !== NONE).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
