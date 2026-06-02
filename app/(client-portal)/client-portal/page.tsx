import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import { getClientDashboardSummary } from "@/features/portals/queries";

export default async function ClientPortalDashboardPage() {
  const summary = await getClientDashboardSummary();

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active campaigns</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.active_campaigns}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.pending_approvals}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending Client IO</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.pending_client_io}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Open invoices</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.open_invoices}</CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest publications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.recent_publications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No publications.</p>
              ) : (
                summary.recent_publications.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.campaign_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.platform} · {item.publication_type}
                      </p>
                    </div>
                    <PortalStatusBadge value={item.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications.</p>
              ) : (
                summary.notifications.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border p-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PlatformErrorBoundary>
  );
}
