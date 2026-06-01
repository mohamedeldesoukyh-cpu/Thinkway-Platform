"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBillingMoney } from "@/features/billing/utils";
import type { MovementBatchRow } from "@/features/operations/types";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  completed: "default",
  failed: "destructive",
  executing: "secondary",
  draft: "outline",
  preview: "outline",
  cancelled: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  brand_to_brand: "Brand → Brand",
  client_to_client: "Client → Client",
  group_to_group: "Group → Group",
};

type ReassignmentCenterProps = {
  batches: MovementBatchRow[];
};

export function ReassignmentCenter({ batches }: ReassignmentCenterProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reassignment history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Audit trail for campaign movements — batch numbers, totals, and execution status.
        </p>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No movement batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Campaigns</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead>Moved by</TableHead>
                  <TableHead>Executed</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-mono text-xs">
                      {batch.document_number}
                    </TableCell>
                    <TableCell>{TYPE_LABELS[batch.movement_type] ?? batch.movement_type}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[batch.status] ?? "outline"}>
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{batch.campaign_count}</TableCell>
                    <TableCell className="text-right">
                      {formatBillingMoney(batch.total_revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBillingMoney(batch.total_gp)}
                    </TableCell>
                    <TableCell className="text-right">{batch.total_invoices}</TableCell>
                    <TableCell>{batch.created_by_name ?? "—"}</TableCell>
                    <TableCell>
                      {batch.executed_at
                        ? format(new Date(batch.executed_at), "MMM d, yyyy HH:mm")
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={batch.reason}>
                      {batch.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
