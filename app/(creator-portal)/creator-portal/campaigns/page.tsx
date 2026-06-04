import Link from "next/link";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getCreatorCampaigns } from "@/features/portals/queries";

export default async function CreatorPortalCampaignsPage() {
  const rows = await getCreatorCampaigns();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned campaigns.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deliverables</TableHead>
                    <TableHead>Publications</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Vendor IO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.assignment_id}>
                      <TableCell>
                        <div>
                          <Link
                            href={`/creator-portal/campaigns/${row.campaign_header_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.campaign_name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{row.campaign_document_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.assignment_status} />
                      </TableCell>
                      <TableCell>
                        {row.pending_deliverables}/{row.deliverable_total} pending
                      </TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.recent_publication_status ?? "pending"} />
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: row.currency_code,
                        }).format(row.agreed_amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PortalStatusBadge value={row.vendor_io_status ?? "draft"} />
                          <Link
                            href="/creator-portal/vendor-ios"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Open
                          </Link>
                        </div>
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
