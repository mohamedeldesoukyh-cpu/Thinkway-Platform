"use client";

import { formatDistanceToNow } from "date-fns";
import { LayoutDashboardIcon } from "lucide-react";

import type { StudioCampaignHistoryItem } from "@/features/studio/services/studio-campaign-history";
import { cn } from "@/lib/utils";

type StudioCampaignHistoryListProps = {
  items: StudioCampaignHistoryItem[];
  activeConversationId?: string;
  onSelect: (item: StudioCampaignHistoryItem) => void;
  emptyLabel?: string;
};

export function StudioCampaignHistoryList({
  items,
  activeConversationId,
  onSelect,
  emptyLabel = "No campaigns yet. Start a new campaign to plan in Studio.",
}: StudioCampaignHistoryListProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
      {items.map((item) => {
        const active = item.conversationId === activeConversationId;
        return (
          <li key={item.campaignObjectId}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                active && "bg-muted/50"
              )}
            >
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--tw-primary,#1D9E75)]/10 text-[var(--tw-primary,#1D9E75)]">
                <LayoutDashboardIcon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {item.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {[item.clientName, item.brandName].filter(Boolean).join(" · ") || "No client yet"}
                  {" · "}
                  {item.statusLabel}
                  {" · "}
                  {item.currentStepLabel}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {item.creatorCount} creator{item.creatorCount === 1 ? "" : "s"}
                  {item.budgetLabel ? ` · ${item.budgetLabel}` : ""}
                  {" · "}
                  {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                </span>
              </span>
              <span className="shrink-0 pt-1 text-[11px] font-medium text-[var(--tw-primary,#1D9E75)]">
                Open →
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
