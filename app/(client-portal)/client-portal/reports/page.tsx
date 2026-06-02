import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getClientReports } from "@/features/portals/queries";

export default async function ClientPortalReportsPage() {
  const rows = await getClientReports();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No report data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Publications</TableHead>
                    <TableHead>Approved publications</TableHead>
                    <TableHead>Deliverables</TableHead>
                    <TableHead>Approved deliverables</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.campaign_header_id}>
                      <TableCell>{row.campaign_name}</TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.campaign_status} />
                      </TableCell>
                      <TableCell>{row.total_publications}</TableCell>
                      <TableCell>{row.approved_publications}</TableCell>
                      <TableCell>{row.total_deliverables}</TableCell>
                      <TableCell>{row.approved_deliverables}</TableCell>
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
