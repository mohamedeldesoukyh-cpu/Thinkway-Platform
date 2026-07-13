import type { CampaignOutputContent } from "../output-types";
import type { MediaPlanData } from "../generators/media-plan";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

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

export function mediaPlanExportBaseName(content: CampaignOutputContent): string {
  const data = isMediaPlanContent(content) ? content.data : undefined;
  const brand = data?.campaignContext?.brandName?.trim();
  const slug = sanitizeFileNameSegment(brand ?? content.title ?? "media-plan");
  return `${slug || "media-plan"}-media-plan`;
}
