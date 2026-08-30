import { listConnectionsForInfluencer } from "@/lib/creator-social/connections/service";
import { buildInternalSocialConnectionViews } from "@/lib/creator-social/views";
import { loadInternalCreatorInsightPack } from "@/lib/creator-insights/service";
import { creatorFacingSyncLine } from "@/lib/creator-social/connections/status";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

export async function CreatorSocialConnectionsInternalPanel({
  influencerId,
}: {
  influencerId: string;
}) {
  const db = tryCreateServiceRoleClient().client;
  const connections = db ? await listConnectionsForInfluencer(db, influencerId) : [];
  const views = buildInternalSocialConnectionViews(connections);
  let pack = null;
  try {
    pack = await loadInternalCreatorInsightPack(influencerId);
  } catch {
    pack = null;
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold">Creator-authorized social connections</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The creator connects these accounts themselves. Thinkway cannot approve OAuth or
          retrieve access tokens.
        </p>
        {views.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No connected social accounts.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {views.map((row) => (
              <li key={`${row.providerId}-${row.handle ?? row.status}`} className="text-sm">
                <span className="font-medium">{row.displayName}</span>
                {row.handle ? ` · ${row.handle}` : ""}
                <span className="text-muted-foreground">
                  {" "}
                  · {row.statusLabel}
                  {row.lastSyncedAt
                    ? ` · Last synced ${new Date(row.lastSyncedAt).toLocaleString()}`
                    : ""}
                </span>
                {row.capabilities.length > 0 ? (
                  <span className="block text-xs text-muted-foreground">
                    Insights: {row.capabilities.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {pack ? (
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">Performance snapshot</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {pack.dataAvailabilityLabel}
            {pack.lastSyncedAt
              ? ` · ${creatorFacingSyncLine("connected", pack.lastSyncedAt) ?? ""}`
              : ""}
            {pack.stale ? " · Latest platform data may be out of date." : ""}
          </p>
          {pack.recommendations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Not enough comparable performance history for a recommendation yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pack.recommendations.map((rec) => (
                <li key={rec.id} className="text-sm">
                  <p className="font-medium">{rec.title}</p>
                  <p className="mt-1 text-muted-foreground">{rec.explanation}</p>
                  <p className="mt-1">{rec.recommendation}</p>
                  {rec.evidence.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {rec.evidence.map((item) => (
                        <li key={`${rec.id}-${item.label}`}>
                          {item.label}: {item.value}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
