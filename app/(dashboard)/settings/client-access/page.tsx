import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientAccessWorkspace } from "@/features/client-access/components/client-access-workspace";
import {
  getAssignableClientProfiles,
  getClientAccessOverviewResult,
} from "@/features/client-access/queries";

export default async function ClientAccessSettingsPage() {
  const overviewResult = await getClientAccessOverviewResult();

  if (!overviewResult.ok) {
    return (
      <DashboardShell
        title="Client access"
        description="Assign client portal users to legal entities with view or approve roles."
      >
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">Could not load client access data.</p>
          <p className="mt-1">{overviewResult.error ?? "Unknown error"}</p>
          {overviewResult.error?.includes("access_role") ? (
            <p className="mt-2 text-xs">
              Run database migrations:{" "}
              <code className="font-mono">npx supabase db push</code>
            </p>
          ) : null}
        </div>
      </DashboardShell>
    );
  }

  const overview = overviewResult.data;

  const entitiesWithAssignable = await Promise.all(
    overview.map(async (entity) => ({
      entity,
      assignable: await getAssignableClientProfiles(entity.client_id),
    }))
  );

  return (
    <DashboardShell
      title="Client access"
      description="Assign client portal users to legal entities with view or approve roles."
    >
      <PlatformErrorBoundary surface="generic">
        <div className="space-y-6">
          {entitiesWithAssignable.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-sm text-muted-foreground">
                No active legal entities found.
              </CardContent>
            </Card>
          ) : (
            entitiesWithAssignable.map(({ entity, assignable }) => (
              <Card key={entity.client_id}>
                <CardHeader>
                  <CardTitle className="text-base">Portal users</CardTitle>
                </CardHeader>
                <CardContent>
                  <ClientAccessWorkspace entity={entity} assignable={assignable} />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
