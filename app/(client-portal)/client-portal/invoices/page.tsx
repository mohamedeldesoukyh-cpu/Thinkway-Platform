import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getClientInvoices } from "@/features/portals/queries";

export default async function ClientPortalInvoicesPage() {
  const rows = await getClientInvoices();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Issue date</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.document_number}</TableCell>
                      <TableCell>{row.campaign_name ?? "—"}</TableCell>
                      <TableCell>{new Date(row.issue_date).toLocaleDateString()}</TableCell>
                      <TableCell>{row.due_date ? new Date(row.due_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency,
                        }).format(row.amount_total)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency,
                        }).format(row.amount_paid)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency,
                        }).format(row.amount_pending)}
                      </TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.status} />
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
