import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getClientPublications } from "@/features/portals/queries";

export default async function ClientPortalPublicationsPage() {
  const rows = await getClientPublications();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Publications</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No publications.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.campaign_name}</TableCell>
                      <TableCell>{row.platform}</TableCell>
                      <TableCell>{row.publication_type}</TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell>
                        {row.publication_date ? new Date(row.publication_date).toLocaleString() : "—"}
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
