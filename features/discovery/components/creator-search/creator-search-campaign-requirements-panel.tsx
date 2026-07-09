"use client";

import { FileTextIcon, PencilIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { buildCampaignRequirementsSummary } from "@/features/campaign-intelligence-profile/services/format-campaign-requirements";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";

type Props = {
  profile: CampaignIntelligenceProfile;
  fileName?: string | null;
  onEdit?: () => void;
  className?: string;
};

export function CreatorSearchCampaignRequirementsPanel({
  profile,
  fileName,
  onEdit,
  className,
}: Props) {
  const summary = buildCampaignRequirementsSummary(profile);
  if (!summary) return null;

  return (
    <section
      className={cn(
        "border-b border-[#c7e8dc] bg-gradient-to-r from-[#ecfdf5] to-[#f0fdf9] px-4 py-3 md:px-5",
        className
      )}
      aria-label="Campaign requirements from brief"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/80 text-[#168a66] shadow-sm ring-1 ring-[#9edfc8]/60">
          <FileTextIcon className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-[#0f5132]">Campaign requirements</h2>
            {fileName ? (
              <span className="truncate text-[11px] font-medium text-[#168a66]/80" title={fileName}>
                from {fileName}
              </span>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D9E75] underline-offset-2 hover:underline"
              >
                <PencilIcon className="size-3" />
                Edit
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#134e38]">{summary}</p>
        </div>
      </div>
    </section>
  );
}
