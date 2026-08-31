import { Card, CardContent } from "@/components/ui/card";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import { CREATOR_ON_BEHALF_ACTOR_LABEL } from "@/lib/services/deliverables/on-behalf";

export function CreatorCampaignMessages({ units }: { units: CreatorUnitView[] }) {
  const messages = units.flatMap((unit) =>
    unit.comments.map((comment) => ({
      ...comment,
      unitLabel: unit.label,
      campaignName: unit.campaignName,
    }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (messages.length === 0) {
    return (
      <p className="rounded-lg border border-border px-4 py-5 text-center text-sm text-muted-foreground">
        No messages on this campaign yet. Use a deliverable to message Thinkway.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {messages.map((item) => (
        <Card key={item.id}>
          <CardContent className="space-y-1 p-3">
            <p className="text-sm font-medium">
              {item.authorDisplayName === CREATOR_ON_BEHALF_ACTOR_LABEL
                ? "Thinkway"
                : item.authorDisplayName ?? "Thinkway"}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.unitLabel} · {new Date(item.createdAt).toLocaleString()}
            </p>
            <p className="text-sm">{item.body}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
