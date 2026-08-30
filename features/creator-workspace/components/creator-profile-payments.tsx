import { Card, CardContent } from "@/components/ui/card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { formatPortalCurrency } from "@/features/portals/components/portal-table-utils";
import type { CreatorPaymentRow } from "@/features/portals/types";

export function CreatorProfilePayments({ rows }: { rows: CreatorPaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No payment records yet.</p>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <Card key={row.assignment_id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate font-medium">{row.campaign_name}</p>
              <PortalStatusBadge value={row.payment_status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Agreed</dt>
                <dd>{formatPortalCurrency(row.agreed_amount, row.currency_code)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Invoiced</dt>
                <dd>{formatPortalCurrency(row.invoiced_amount, row.currency_code)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Paid</dt>
                <dd>{formatPortalCurrency(row.paid_amount, row.currency_code)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Pending</dt>
                <dd>{formatPortalCurrency(row.pending_amount, row.currency_code)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
