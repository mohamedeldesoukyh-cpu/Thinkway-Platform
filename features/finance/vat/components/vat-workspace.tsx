"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBillingMoney } from "@/features/billing/utils";
import { buildVatAuditCsv } from "@/features/finance/vat/export";
import type { VatWorkspaceData } from "@/features/finance/vat/types";

type VatWorkspaceProps = {
  data: VatWorkspaceData;
};

export function VatWorkspace({ data }: VatWorkspaceProps) {
  const [includeVatColumns, setIncludeVatColumns] = useState(true);

  const csvContent = useMemo(
    () => buildVatAuditCsv(data, includeVatColumns),
    [data, includeVatColumns]
  );

  function downloadCsv() {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vat-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeVatColumns}
            onChange={(e) => setIncludeVatColumns(e.target.checked)}
            className="size-4 rounded border border-input"
          />
          Include VAT in export
        </label>
        <Button type="button" variant="outline" size="sm" onClick={downloadCsv}>
          <DownloadIcon data-icon="inline-start" />
          VAT audit export
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Revenue (ex-VAT)"
          value={formatBillingMoney(data.kpis.revenue_before_vat, "USD")}
        />
        <KpiCard label="Output VAT" value={formatBillingMoney(data.kpis.output_vat, "USD")} />
        <KpiCard label="Input VAT" value={formatBillingMoney(data.kpis.input_vat, "USD")} />
        <KpiCard
          label="Net VAT payable"
          value={formatBillingMoney(data.kpis.net_vat_payable, "USD")}
        />
        <KpiCard
          label="VAT reclaimable"
          value={formatBillingMoney(data.kpis.vat_reclaimable, "USD")}
        />
      </div>

      <Tabs defaultValue="settlement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="country">By country</TabsTrigger>
          <TabsTrigger value="entity">By legal entity</TabsTrigger>
          <TabsTrigger value="invoices">By invoice</TabsTrigger>
        </TabsList>

        <TabsContent value="settlement">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">VAT settlement summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row label="Output VAT (client invoices)" value={data.kpis.output_vat} />
              <Row label="Input VAT (vendor costs)" value={data.kpis.input_vat} />
              <Row label="Net VAT payable" value={data.kpis.net_vat_payable} strong />
              <p className="text-xs text-muted-foreground pt-2">
                Net payable = Output VAT − Input VAT. Operational revenue, cost, GP, and margin
                never include VAT.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <DataTable
            headers={["Month", "Revenue ex-VAT", "Output VAT", "Input VAT", "Net payable"]}
            rows={data.monthly.map((row) => [
              row.label,
              formatBillingMoney(row.revenue_before_vat, "USD"),
              formatBillingMoney(row.output_vat, "USD"),
              formatBillingMoney(row.input_vat, "USD"),
              formatBillingMoney(row.net_vat_payable, "USD"),
            ])}
          />
        </TabsContent>

        <TabsContent value="country">
          <DataTable
            headers={["Country", "Output VAT", "Input VAT", "Net payable"]}
            rows={data.by_country.map((row) => [
              row.country_code,
              formatBillingMoney(row.output_vat, "USD"),
              formatBillingMoney(row.input_vat, "USD"),
              formatBillingMoney(row.net_vat_payable, "USD"),
            ])}
          />
        </TabsContent>

        <TabsContent value="entity">
          <DataTable
            headers={["Legal entity", "Country", "Revenue ex-VAT", "Output VAT"]}
            rows={data.by_entity.map((row) => [
              row.client_name,
              row.country_code ?? "—",
              formatBillingMoney(row.revenue_before_vat, "USD"),
              formatBillingMoney(row.output_vat, "USD"),
            ])}
          />
        </TabsContent>

        <TabsContent value="invoices">
          <DataTable
            headers={[
              "Invoice",
              "Client",
              "Country",
              "Ex-VAT",
              "VAT",
              "Total",
              "",
            ]}
            rows={data.invoices.map((row) => [
              formatDocumentNumberForDisplay(row.document_number),
              row.client_name,
              row.country_code ?? "—",
              formatBillingMoney(row.revenue_before_vat, row.currency),
              formatBillingMoney(row.output_vat, row.currency),
              formatBillingMoney(row.total_after_vat, row.currency),
              <Link
                key={row.id}
                href={`/billing/invoices/${row.id}`}
                className="text-primary hover:underline"
              >
                Open
              </Link>,
            ])}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{formatBillingMoney(value, "USD")}</span>
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-muted-foreground">
                  No VAT data yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
