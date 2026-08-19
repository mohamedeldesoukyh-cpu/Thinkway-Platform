"use client";

import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { STUDIO_REF_CLASSES } from "@/features/campaign-studio/constants/campaign-studio-ref-tokens";
import { StudioCampaignHistorySheet } from "@/features/studio/components/studio-campaign-history-sheet";
import { cn } from "@/lib/utils";

type StudioConversationControlsProps = {
  activeId?: string;
  className?: string;
  refMode?: boolean;
};

export function StudioConversationControls({
  activeId,
  className,
  refMode = false,
}: StudioConversationControlsProps) {
  const router = useRouter();

  function openNewCampaign() {
    router.push("/studio?new=1");
  }

  if (refMode) {
    return (
      <div className={cn("flex shrink-0 items-center gap-2", className)}>
        <button
          type="button"
          className={cn(STUDIO_REF_CLASSES.btn, STUDIO_REF_CLASSES.btnPrimary)}
          onClick={openNewCampaign}
        >
          <PlusIcon aria-hidden />
          New Campaign
        </button>
        <StudioCampaignHistorySheet
          activeConversationId={activeId}
          triggerClassName={STUDIO_REF_CLASSES.btn}
          triggerLabel="Campaign History"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <Button
        type="button"
        size="sm"
        onClick={openNewCampaign}
        className="h-8 gap-1.5 rounded-lg bg-[#0057FF] px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0046CC]"
      >
        <PlusIcon className="size-3.5" strokeWidth={2.4} aria-hidden />
        <span className="hidden sm:inline">New Campaign</span>
        <span className="sm:hidden">New</span>
      </Button>
      <StudioCampaignHistorySheet activeConversationId={activeId} />
    </div>
  );
}
