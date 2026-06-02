import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientApprovalForm } from "@/features/portals/components/client-approval-form";
import { ClientPoUploadForm } from "@/features/portals/components/client-po-upload-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getClientIosList } from "@/features/portals/queries";

export default async function ClientPortalClientIoPage() {
  const rows = await getClientIosList();

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Client IO</CardTitle>
          </CardHeader>
          <CardContent>
            {(rows as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No client IO records.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Approved</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rows as any[]).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.campaign?.name ?? "—"}</TableCell>
                        <TableCell>
                          <PortalStatusBadge value={row.status} />
                        </TableCell>
                        <TableCell>{row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}</TableCell>
                        <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-right">
                          {row.status === "sent" ? (
                            <ClientApprovalForm entityType="client_io" entityId={row.id} />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload campaign PO</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(rows as any[]).slice(0, 3).map((row) => (
              <ClientPoUploadForm key={row.id} campaignHeaderId={row.campaign_header_id as string} />
            ))}
            {(rows as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No campaign context yet for PO upload.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PlatformErrorBoundary>
  );
}
