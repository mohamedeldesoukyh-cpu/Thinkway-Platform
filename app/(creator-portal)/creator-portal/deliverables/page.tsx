import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatorDeliverableUploadForm } from "@/features/portals/components/creator-deliverable-upload-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getCreatorDeliverables } from "@/features/portals/queries";

export default async function CreatorPortalDeliverablesPage() {
  const rows = await getCreatorDeliverables();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Deliverables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables assigned.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deliverable</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <p className="font-medium">{row.title}</p>
                          <p className="text-xs text-muted-foreground">{row.document_number}</p>
                        </TableCell>
                        <TableCell>{row.campaign_name}</TableCell>
                        <TableCell>
                          <PortalStatusBadge value={row.status} />
                        </TableCell>
                        <TableCell>{row.due_date ? new Date(row.due_date).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-4">
                {rows.slice(0, 6).map((row) => (
                  <CreatorDeliverableUploadForm key={row.id} deliverableId={row.id} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PlatformErrorBoundary>
  );
}
