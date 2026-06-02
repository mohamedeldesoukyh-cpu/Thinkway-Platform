"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { VendorPayablesPayload } from "@/lib/vendor-payables/load-payables";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";

type VendorPayablesSectionProps = {
  payables: VendorPayablesPayload | null;
};

export function VendorPayablesSection({ payables }: VendorPayablesSectionProps) {
  if (!payables) {
    return (
      <p className="text-sm text-muted-foreground">Vendor payables data unavailable.</p>
    );
  }

  const currency = {
    primary_currency: "USD",
    is_mixed_currency: false,
    currencies: ["USD"],
    mixed_label: null,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Outstanding AP</p>
          <p className="text-lg font-semibold">
            {formatAnalyticsAmount(payables.total_pending, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Paid (loaded slice)</p>
          <p className="text-lg font-semibold">
            {formatAnalyticsAmount(payables.total_paid, currency)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payables.rows
              .filter((r) => r.status !== "paid")
              .slice(0, 30)
              .map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.influencer_name}</TableCell>
                  <TableCell className="max-w-[160px] truncate">{row.campaign_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatAnalyticsAmount(row.agreed_fee, {
                      ...currency,
                      primary_currency: row.currency,
                    })}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
