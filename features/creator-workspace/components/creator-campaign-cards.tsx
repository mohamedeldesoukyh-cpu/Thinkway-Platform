import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { DocumentNumber } from "@/components/ui/document-number";
import { toCreatorCampaignCard } from "@/features/creator-workspace/campaign-card-model";
import type { CreatorCampaignRow } from "@/features/portals/types";
import { cn } from "@/lib/utils";

export function CreatorCampaignCards({ rows }: { rows: CreatorCampaignRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No assigned campaigns yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const card = toCreatorCampaignCard(row);
        return (
          <Link key={card.assignmentId} href={card.href} className="block">
            <Card
              className={cn(
                "transition-colors hover:border-primary/40",
                card.needsAction && "border-primary/30"
              )}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{card.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <DocumentNumber value={card.documentNumber} />
                    </p>
                  </div>
                  <span
                    className={cn(
                      "w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                      card.needsAction
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {card.actionLine}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{card.dateLine}</p>
                {card.publicationLine ? (
                  <p className="text-xs text-muted-foreground">{card.publicationLine}</p>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
