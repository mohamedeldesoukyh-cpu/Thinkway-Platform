import {
  CREATOR_CAMPAIGN_STAGES,
  creatorCampaignStageIndex,
  type CreatorCampaignStageId,
} from "@/features/creator-workspace/campaign-progress";

export function CreatorCampaignProgress({
  stage,
}: {
  stage: CreatorCampaignStageId;
}) {
  const current = creatorCampaignStageIndex(stage);

  return (
    <div className="rail">
      {CREATOR_CAMPAIGN_STAGES.map((item, index) => (
        <div
          key={item.id}
          className="rail__s"
          data-on={index < current}
          data-now={index === current}
        >
          <span className="rail__d" />
          <span className="rail__n num">{String(index + 1).padStart(2, "0")}</span>
          <span className="rail__l">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
