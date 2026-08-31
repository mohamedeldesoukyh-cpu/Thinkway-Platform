import {
  CREATOR_CAMPAIGN_STAGES,
  creatorCampaignStageIndex,
  type CreatorCampaignStageId,
} from "@/features/creator-workspace/campaign-progress";
import { cn } from "@/lib/utils";

export function CreatorCampaignProgress({
  stage,
}: {
  stage: CreatorCampaignStageId;
}) {
  const current = creatorCampaignStageIndex(stage);

  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {CREATOR_CAMPAIGN_STAGES.map((item, index) => {
        const state =
          index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li
            key={item.id}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              state === "current" && "border-primary bg-primary/5 font-medium",
              state === "done" && "border-border text-muted-foreground",
              state === "upcoming" && "border-dashed border-border text-muted-foreground"
            )}
          >
            <span className="text-[11px] uppercase tracking-wide">
              {index + 1 < 10 ? `0${index + 1}` : index + 1}
            </span>
            <p>{item.label}</p>
          </li>
        );
      })}
    </ol>
  );
}
