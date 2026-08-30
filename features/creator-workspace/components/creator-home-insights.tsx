import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { CreatorFacingRecommendation, CreatorInsightPack } from "@/lib/creator-insights/types";
import { cn } from "@/lib/utils";

function recHrefLabel(rec: CreatorFacingRecommendation): string | null {
  if (rec.type === "data_enrichment") return "Social Accounts";
  if (rec.campaignHeaderId) return "View campaign";
  return rec.href ? "Open" : null;
}

export function CreatorHomeInsights({ pack }: { pack: CreatorInsightPack }) {
  const recs = pack.recommendations;

  return (
    <section className="space-y-3" aria-labelledby="creator-home-insights">
      <h3 id="creator-home-insights" className="text-sm font-semibold">
        Thinkway Insights
      </h3>
      {recs.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm">
              {pack.collectingMessage ??
                "Thinkway is collecting more performance data. Connect your social account to unlock richer insights."}
            </p>
            <Link
              href="/creator-portal/profile"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Profile → Social Accounts
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {recs.map((rec) => {
            const hrefLabel = recHrefLabel(rec);
            return (
              <Card key={rec.id}>
                <CardContent className="space-y-2 p-4">
                  <p className="text-sm font-semibold">{rec.title}</p>
                  <p className="text-sm text-muted-foreground">{rec.explanation}</p>
                  <p className="text-sm">{rec.recommendation}</p>
                  {pack.stale && rec.type !== "data_enrichment" ? (
                    <p className="text-xs text-muted-foreground">
                      Based on your latest synced data
                      {pack.lastSyncedAt
                        ? ` · ${new Date(pack.lastSyncedAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  ) : null}
                  {hrefLabel && rec.href ? (
                    <Link
                      href={rec.href}
                      className={cn(
                        "inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                      )}
                    >
                      {hrefLabel}
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
