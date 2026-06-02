import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientApprovalForm } from "@/features/portals/components/client-approval-form";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getClientApprovals } from "@/features/portals/queries";

export default async function ClientPortalApprovalsPage() {
  const rows = await getClientApprovals();

  return (
    <PlatformErrorBoundary surface="generic">
      <Card>
        <CardHeader>
          <CardTitle>Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approvals pending.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.campaign_name}</TableCell>
                      <TableCell>{row.entity_type}</TableCell>
                      <TableCell>{row.title}</TableCell>
                      <TableCell>
                        <PortalStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status === "Pending" ? (
                          <ClientApprovalForm entityType={row.entity_type} entityId={row.entity_id} />
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
    </PlatformErrorBoundary>
  );
}
