import { DocumentNumber } from "@/components/ui/document-number";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreatorDeliverableRowPanel } from "@/features/portals/components/creator-deliverable-row";
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
        <CardContent className="space-y-6">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables assigned.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deliverable</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Content</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-medium">{row.title}</p>
                        <p className="text-xs text-muted-foreground">
                          <DocumentNumber value={row.document_number} />
                        </p>
                      </TableCell>
                      <TableCell>{row.campaign_name}</TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell>
                        {row.due_date ? new Date(row.due_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {row.content_url ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="grid gap-4">
                {rows.map((row) => (
                  <CreatorDeliverableRowPanel key={row.id} deliverable={row} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PlatformErrorBoundary>
  );
}
