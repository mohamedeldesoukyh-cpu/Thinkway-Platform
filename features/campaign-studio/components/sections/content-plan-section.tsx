"use client";

import { cn } from "@/lib/utils";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { ObjectiveBadge } from "./shared/studio-ui-primitives";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { resolveContentPlan } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ContentPlanSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

export function ContentPlanSection({
  campaignObject,
  fallbackText,
  status,
}: ContentPlanSectionProps) {
  if (status === "running" && !fallbackText.trim() && !campaignObject) {
    return <SectionSkeleton variant="cards" />;
  }

  const items = resolveContentPlan(campaignObject);
  if (items.length === 0) {
    if (shouldShowPendingPlaceholder(status, false)) {
      return <SectionPendingMessage label="Content plan pending…" />;
    }
    return <SectionFallbackContent text={fallbackText} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className={STUDIO_CLASSES.ptable}>
        <caption className="sr-only">Campaign content plan by platform and objective</caption>
        <thead>
          <tr>
            <th scope="col" className={STUDIO_CLASSES.ptableTh}>
              Platform
            </th>
            <th scope="col" className={STUDIO_CLASSES.ptableTh}>
              Content Type
            </th>
            <th scope="col" className={STUDIO_CLASSES.ptableTh}>
              Tier
            </th>
            <th scope="col" className={STUDIO_CLASSES.ptableTh}>
              Qty
            </th>
            <th scope="col" className={STUDIO_CLASSES.ptableTh}>
              Posting
            </th>
            <th scope="col" className={STUDIO_CLASSES.ptableTh}>
              Objective
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.platform}-${index}`}>
              <td className={cn(STUDIO_CLASSES.ptableTd, "font-semibold capitalize")}>
                {item.platform}
              </td>
              <td className={STUDIO_CLASSES.ptableTd}>{item.contentType}</td>
              <td className={STUDIO_CLASSES.ptableTd}>{item.creatorTier}</td>
              <td className={cn(STUDIO_CLASSES.ptableTd, "font-extrabold")}>{item.quantity}</td>
              <td className={STUDIO_CLASSES.ptableTd}>{item.postingDate}</td>
              <td className={STUDIO_CLASSES.ptableTd}>
                <ObjectiveBadge objective={item.objective} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}