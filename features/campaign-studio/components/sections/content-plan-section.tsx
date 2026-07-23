"use client";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { ObjectiveBadge } from "./shared/studio-ui-primitives";
import { STUDIO_REF_CLASSES } from "../../constants/campaign-studio-ref-tokens";
import { STUDIO_CLASSES } from "../../constants/studio-tokens";
import { useStudioRefMode } from "../../hooks/use-studio-ref-mode";
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
  const refMode = useStudioRefMode();

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

  const tableClass = refMode ? STUDIO_REF_CLASSES.planTable : STUDIO_CLASSES.ptable;
  const thClass = refMode ? undefined : STUDIO_CLASSES.ptableTh;
  const tdClass = refMode ? undefined : STUDIO_CLASSES.ptableTd;

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <caption className="sr-only">Campaign content plan by platform and objective</caption>
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Platform
            </th>
            <th scope="col" className={thClass}>
              Content Type
            </th>
            <th scope="col" className={thClass}>
              Tier
            </th>
            <th scope="col" className={thClass}>
              Qty
            </th>
            <th scope="col" className={thClass}>
              Posting
            </th>
            <th scope="col" className={thClass}>
              Objective
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.platform}-${index}`}>
              <td className={tdClass}>{item.platform}</td>
              <td className={tdClass}>{item.contentType}</td>
              <td className={tdClass}>{item.creatorTier}</td>
              <td className={refMode ? STUDIO_REF_CLASSES.mono : tdClass}>{item.quantity}</td>
              <td className={tdClass}>{item.postingDate}</td>
              <td className={tdClass}>
                <ObjectiveBadge objective={item.objective} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
