"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
} from "@/lib/finance/po/status";
import { formatMoney } from "@/features/campaigns/utils";
import type { PoTrackerWorkspaceData } from "@/features/finance/po-tracker/types";

const NONE = "__all__";

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Group"
            value={searchParams.get("group_id") ?? NONE}
            onChange={(v) => setFilter("group_id", v)}
            options={data.filter_options.groups.map((g) => ({
              value: g.id,
              label: g.name,
            }))}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PO tracker</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Original PO</TableHead>
                <TableHead className="text-right">Converted PO</TableHead>
                <TableHead className="text-right">Consumed</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Remaining %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">FX</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground">
                    No PO records match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row) => (
                  <TableRow key={row.campaign_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {row.is_over_consumed ? (
                          <AlertTriangleIcon className="size-4 text-destructive" />
                        ) : null}
                        <span>{row.po_number ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{row.client_name}</TableCell>
                    <TableCell>{row.brand_name}</TableCell>
                    <TableCell>
                      <Link
                        href={`/campaigns/${row.campaign_id}`}
                        className="font-medium hover:underline"
                      >
                        {row.campaign_name}
                      </Link>
                    </TableCell>
                    <TableCell>{row.po_currency ?? row.campaign_currency}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.po_amount_original, row.po_currency ?? row.campaign_currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.po_amount_campaign_currency, row.campaign_currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.po_consumed_amount, row.campaign_currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.po_remaining_amount, row.campaign_currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.po_remaining_percent != null
                        ? `${row.po_remaining_percent.toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PO_STATUS_VARIANT[row.po_status]}>
                        {PO_STATUS_LABELS[row.po_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.po_expiry_date ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {row.po_exchange_rate?.toFixed(4) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
    <Card className={alert ? "border-destructive/40" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${alert ? "text-destructive" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
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
