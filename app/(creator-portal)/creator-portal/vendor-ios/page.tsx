import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatorApproveVendorIoForm } from "@/features/portals/components/creator-approve-vendor-io-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getCreatorVendorIos } from "@/features/portals/queries";

export default async function CreatorPortalVendorIosPage() {
  const rows = await getCreatorVendorIos();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Vendor IOs</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vendor IO records.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.campaign_name}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency_code,
                        }).format(row.amount)}
                      </TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell>{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</TableCell>
                      <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</TableCell>
                      <TableCell className="text-right">
                        {row.status === "sent" ? <CreatorApproveVendorIoForm vendorIoId={row.id} /> : "—"}
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
