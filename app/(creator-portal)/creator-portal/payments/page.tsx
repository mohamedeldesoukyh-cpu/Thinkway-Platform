import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getCreatorPayments } from "@/features/portals/queries";

export default async function CreatorPortalPaymentsPage() {
  const rows = await getCreatorPayments();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Agreed amount</TableHead>
                    <TableHead>Invoiced</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.assignment_id}>
                      <TableCell>{row.campaign_name}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency_code,
                        }).format(row.agreed_amount)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency_code,
                        }).format(row.invoiced_amount)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency_code,
                        }).format(row.paid_amount)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency_code,
                        }).format(row.pending_amount)}
                      </TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.payment_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </PlatformErrorBoundary>
  );
}
