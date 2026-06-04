import { DocumentNumber } from "@/components/ui/document-number";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getClientCampaigns } from "@/features/portals/queries";

export default async function ClientPortalCampaignsPage() {
  const rows = await getClientCampaigns();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaigns.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Deliverables</TableHead>
                    <TableHead>Publications</TableHead>
                    <TableHead>Approvals</TableHead>
                    <TableHead>Client IO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.campaign_header_id}>
                      <TableCell>
                        <p className="font-medium">{row.campaign_name}</p>
                        <p className="text-xs text-muted-foreground">
                          <DocumentNumber value={row.campaign_document_number} />
                        </p>
                      </TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell>{row.deliverable_total}</TableCell>
                      <TableCell>{row.publication_total}</TableCell>
                      <TableCell>{row.pending_approvals} pending</TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.client_io_status ?? "draft"} />
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
