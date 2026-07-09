"use client";

import { PencilIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";

type Props = {
  criteria: CampaignSearchCriterion[];
  onRemove: (id: string) => void;
  onEditStrategy?: () => void;
  className?: string;
};

function formatChipLabel(item: CampaignSearchCriterion): string {
  if (item.label === "Audience Age") {
    return `Audience Age : ${item.value}`;
  }
  if (item.label === "Gender") {
    return `Gender : ${item.value}`;
  }
  if (item.kind === "platform") {
    const platform =
      item.value.charAt(0).toUpperCase() + item.value.slice(1).toLowerCase();
    return `Social Platform : ${platform}`;
  }
  return `${item.label} : ${item.value}`;
}

export function CreatorSearchAiCriteriaChips({
  criteria,
  onRemove,
  onEditStrategy,
  className,
}: Props) {
  const enabled = criteria.filter((c) => c.enabled && c.value.trim());
  if (enabled.length === 0) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-background px-4 py-2 md:px-5",
        className
      )}
    >
      {enabled.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onRemove(item.id)}
          className={cn(
            "group inline-flex max-w-full items-center gap-1 rounded-full border border-[#9edfc8] bg-[#ecfdf5]",
            "py-1 pr-1.5 pl-2.5 text-[11px] font-medium text-[#168a66] transition-colors hover:bg-[#d1fae5]"
          )}
        >
          <span className="truncate">{formatChipLabel(item)}</span>
          {item.weight > 0 ? (
            <span className="shrink-0 rounded bg-[#1D9E75]/15 px-1 py-px text-[10px] font-semibold text-[#168a66]">
              {item.weight}%
            </span>
          ) : null}
          <XIcon className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
      {onEditStrategy ? (
        <button
          type="button"
          onClick={onEditStrategy}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1D9E75] underline-offset-2 hover:underline"
        >
          <PencilIcon className="size-3" />
          Edit strategy
        </button>
      ) : null}
    </div>
  );
}
