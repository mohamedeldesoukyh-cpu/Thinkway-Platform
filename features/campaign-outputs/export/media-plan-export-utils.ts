import type { CampaignOutputContent } from "../output-types";
import { sanitizeFileNameSegment } from "@/lib/reports/document/report-document-response";

export { isMediaPlanContent } from "./media-plan-content";
import { isMediaPlanContent } from "./media-plan-content";

export function mediaPlanExportBaseName(content: CampaignOutputContent): string {
  const data = isMediaPlanContent(content) ? content.data : undefined;
  const brand = data?.campaignContext?.brandName?.trim();
  const slug = sanitizeFileNameSegment(brand ?? content.title ?? "media-plan");
  return `${slug || "media-plan"}-media-plan`;
}
