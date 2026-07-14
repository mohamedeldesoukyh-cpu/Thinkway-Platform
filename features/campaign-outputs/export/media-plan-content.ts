import type { CampaignOutputContent } from "../output-types";
import type { MediaPlanData } from "../generators/media-plan";

export function isMediaPlanContent(content: CampaignOutputContent): content is CampaignOutputContent & {
  data: MediaPlanData;
} {
  const data = content.data;
  return Boolean(
    data &&
      typeof data === "object" &&
      Array.isArray((data as { weeks?: unknown }).weeks) &&
      typeof (data as { durationWeeks?: unknown }).durationWeeks === "number"
  );
}
