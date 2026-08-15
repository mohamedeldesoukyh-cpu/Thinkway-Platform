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
    return (
      <SectionFallbackContent
        text={
          fallbackText.trim() ||
          "Per-creator content plan appears after Strategy and creator recommendations are in place."
        }
      />
    );
  }

  const tableClass = refMode ? STUDIO_REF_CLASSES.planTable : STUDIO_CLASSES.ptable;
  const thClass = refMode ? undefined : STUDIO_CLASSES.ptableTh;
  const tdClass = refMode ? undefined : STUDIO_CLASSES.ptableTd;

  return (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <caption className="sr-only">Per-creator influencer content plan</caption>
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Creator / Role
            </th>
            <th scope="col" className={thClass}>
              Platform
            </th>
            <th scope="col" className={thClass}>
              Deliverable
            </th>
            <th scope="col" className={thClass}>
              Concept
            </th>
            <th scope="col" className={thClass}>
              Hook
            </th>
            <th scope="col" className={thClass}>
              Key message
            </th>
            <th scope="col" className={thClass}>
              CTA
            </th>
            <th scope="col" className={thClass}>
              Timing
            </th>
            <th scope="col" className={thClass}>
              Objective
            </th>
            <th scope="col" className={thClass}>
              Expected KPI
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.creatorId ?? item.platform}-${index}`}>
              <td className={tdClass}>
                <span className="font-semibold">{item.creatorName ?? "Creator"}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {item.creatorRole ?? item.creatorTier}
                </span>
              </td>
              <td className={tdClass}>{item.platform}</td>
              <td className={tdClass}>{item.contentType}</td>
              <td className={tdClass}>{item.contentConcept ?? "—"}</td>
              <td className={tdClass}>{item.hook ?? "—"}</td>
              <td className={tdClass}>{item.keyMessage ?? "—"}</td>
              <td className={tdClass}>{item.cta ?? "—"}</td>
              <td className={tdClass}>{item.postingDate}</td>
              <td className={tdClass}>
                <ObjectiveBadge objective={item.objective} />
              </td>
              <td className={tdClass}>{item.expectedKpi ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {items[0]?.strategyTrace ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{items[0].strategyTrace}</p>
      ) : null}
    </div>
  );
}
