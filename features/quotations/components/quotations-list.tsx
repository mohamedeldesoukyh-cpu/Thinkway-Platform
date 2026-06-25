"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QUOTATION_STATUS_LABELS, quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationListRow } from "@/features/quotations/types";

function egp(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} EGP`;
}

export function QuotationsList({ quotations }: { quotations: QuotationListRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Serial</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Client / Brand</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Creators</TableHead>
            <TableHead className="text-right">Revenue (EGP)</TableHead>
            <TableHead className="text-right">GP %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotations.map((q) => (
            <TableRow key={q.id} className="cursor-pointer">
              <TableCell className="font-mono text-xs">
                <Link href={quotationDetailPath(q.id)} className="hover:text-primary">
                  {q.serial_number ?? "—"}
                </Link>
              </TableCell>
              <TableCell className="font-medium">
                <Link href={quotationDetailPath(q.id)} className="hover:text-primary">
                  {q.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {[q.client_name, q.brand_name].filter(Boolean).join(" · ") || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{QUOTATION_STATUS_LABELS[q.status]}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{q.item_count}</TableCell>
              <TableCell className="text-right tabular-nums">
                {egp(q.total_revenue_egp)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {q.total_gp_pct.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
