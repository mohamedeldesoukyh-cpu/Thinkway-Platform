import Link from "next/link";

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
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import { LINE_BILLING_STATUS_LABELS, VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";

export function VendorAssignmentsTab({ workspace }: { workspace: VendorWorkspace }) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Assignment history</CardTitle>
          <p className="text-sm text-muted-foreground">
            Campaign lines, deliverables, commercial terms, and operational status.
          </p>
        </CardHeader>
        <CardContent>
          {workspace.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaign assignments yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Assignment line</TableHead>
                    <TableHead>Ops status</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">GP</TableHead>
                    <TableHead>Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        {a.campaign_id ? (
                          <Link
                            href={`/campaigns/${a.campaign_id}`}
                            className="font-medium hover:underline"
                          >
                            {a.campaign_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                        <p className="font-mono text-xs text-muted-foreground">
                          {a.campaign_document_number}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{a.line_name ?? "—"}</span>
                        <p className="font-mono text-xs text-muted-foreground">
                          {a.line_document_number}
                        </p>
                      </TableCell>
                      <TableCell>
                        {a.assignment_status ? (
                          <AssignmentStatusBadge
                            status={
                              a.assignment_status as import("@/features/campaigns/types").CampaignLineAssignmentStatus
                            }
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {a.billing_status
                            ? LINE_BILLING_STATUS_LABELS[a.billing_status]
                            : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(a.revenue, a.currency || currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(a.cost, a.currency || currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(a.gp, a.currency || currency)}
                      </TableCell>
                      <TableCell>
                        {a.vendor_payment_status ? (
                          <Badge variant="secondary">
                            {VENDOR_PAYMENT_STATUS_LABELS[a.vendor_payment_status]}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform performance summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            GP contribution: {formatMoney(workspace.financials.total_gp, currency)}{" "}
            ({formatPercent(workspace.financials.margin_percent)} margin) across{" "}
            {workspace.counts.assignments} assignment(s).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
