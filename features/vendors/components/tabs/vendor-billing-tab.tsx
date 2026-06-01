import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney } from "@/features/vendors/utils";

export function VendorBillingTab({ workspace }: { workspace: VendorWorkspace }) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";
  const { financials } = workspace;

  const summary = [
    { label: "Assignment revenue", value: formatMoney(financials.total_revenue, currency) },
    { label: "Creator cost", value: formatMoney(financials.total_cost, currency) },
    { label: "GP contribution", value: formatMoney(financials.total_gp, currency) },
    { label: "Invoiced", value: formatMoney(financials.invoiced_amount, currency) },
    { label: "Paid out", value: formatMoney(financials.paid_out, currency) },
    { label: "Pending payout", value: formatMoney(financials.pending_payout, currency) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-heading text-2xl font-semibold tracking-tight">
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout history</CardTitle>
          <p className="text-sm text-muted-foreground">
            Creator payouts linked to campaign assignments and payment batches.
          </p>
        </CardHeader>
        <CardContent>
          {workspace.payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payout records.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspace.payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.campaign_name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(p.amount, p.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {VENDOR_PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
