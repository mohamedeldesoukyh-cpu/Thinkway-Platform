"use client";

import { BrainIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import type { CampaignIntelligenceWorkspaceState } from "../actions/profile-actions";
import type { CampaignIntelligenceProfile } from "../types/profile";
import { CampaignIntelligencePanel } from "./campaign-intelligence-panel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialState?: CampaignIntelligenceWorkspaceState | null;
  onWorkspaceChange?: (state: CampaignIntelligenceWorkspaceState) => void;
  onProfileReady?: (profileId: string, profile: CampaignIntelligenceProfile) => void;
};

export function CampaignIntelligenceSidebar({
  open,
  onOpenChange,
  initialState,
  onWorkspaceChange,
  onProfileReady,
}: Props) {
  function handleWorkspaceChange(state: CampaignIntelligenceWorkspaceState) {
    onWorkspaceChange?.(state);
    onProfileReady?.(state.profileId, state.profile);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full w-[min(420px,92vw)] max-w-[420px] flex-col border-l border-border p-0 sm:max-w-[420px]"
      >
        <SheetTitle className="sr-only">Campaign brief intelligence</SheetTitle>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <BrainIcon className="size-4 text-[#1D9E75]" />
            <div>
              <p className="text-sm font-semibold">Campaign brief</p>
              <p className="text-[11px] text-muted-foreground">Upload, review, and save intelligence</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onOpenChange(false)}
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <CampaignIntelligencePanel
            key={initialState?.profileId ?? "new"}
            compact
            initialState={initialState}
            onWorkspaceChange={handleWorkspaceChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
