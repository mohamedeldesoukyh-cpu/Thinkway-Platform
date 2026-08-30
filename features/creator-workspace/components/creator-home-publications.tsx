import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import type { CreatorPublicationRow } from "@/features/portals/types";

export function CreatorHomePublications({
  rows,
}: {
  rows: CreatorPublicationRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent publications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent publications.</p>
        ) : (
          rows.map((item) => (
            <Link
              key={item.id}
              href={`/creator-portal/campaigns/${item.campaign_header_id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.campaign_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.platform} · {item.publication_type}
                </p>
              </div>
              <PortalStatusBadge value={item.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
