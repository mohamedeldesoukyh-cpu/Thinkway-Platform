"use client";

import { Badge } from "@/components/ui/badge";

import { SectionSkeleton } from "./shared/section-skeleton";
import {
  SectionFallbackContent,
  SectionPendingMessage,
  shouldShowPendingPlaceholder,
} from "./shared/section-status-utils";
import { resolveContentPlan } from "../../services/section-data-resolver";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStudioSectionStatus } from "../../types/campaign-studio";

type ContentPlanSectionProps = {
  campaignObject?: CampaignObject;
  fallbackText: string;
  status: CampaignStudioSectionStatus;
};

const OBJECTIVE_COLORS: Record<string, string> = {
  Awareness: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  Engagement: "bg-[#1D9E75]/10 text-[#1D9E75]",
  "UGC volume": "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
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
      <table className="w-full min-w-[480px] text-left text-[11px]">
        <thead>
          <tr className="border-b border-border/60 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
            <th className="pb-2 pr-3">Platform</th>
            <th className="pb-2 pr-3">Content Type</th>
            <th className="pb-2 pr-3">Creator Tier</th>
            <th className="pb-2 pr-3">Qty</th>
            <th className="pb-2 pr-3">Posting</th>
            <th className="pb-2">Objective</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.platform}-${index}`} className="border-b border-border/30">
              <td className="py-2 pr-3 font-semibold capitalize">{item.platform}</td>
              <td className="py-2 pr-3">{item.contentType}</td>
              <td className="py-2 pr-3">
                <Badge variant="outline" className="text-[9px]">
                  {item.creatorTier}
                </Badge>
              </td>
              <td className="py-2 pr-3 font-bold">{item.quantity}</td>
              <td className="py-2 pr-3 text-muted-foreground">{item.postingDate}</td>
              <td className="py-2">
                <Badge className={OBJECTIVE_COLORS[item.objective] ?? "bg-muted text-foreground"}>
                  {item.objective}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
