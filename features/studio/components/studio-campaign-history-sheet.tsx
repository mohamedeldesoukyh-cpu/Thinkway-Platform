"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HistoryIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { listStudioCampaignHistoryAction } from "@/features/studio/actions/list-studio-campaign-history-action";
import type { StudioCampaignHistoryItem } from "@/features/studio/services/studio-campaign-history";

import { StudioCampaignHistoryList } from "./studio-campaign-history-list";

type StudioCampaignHistorySheetProps = {
  activeConversationId?: string;
  triggerClassName?: string;
  triggerLabel?: string;
};

export function StudioCampaignHistorySheet({
  activeConversationId,
  triggerClassName,
  triggerLabel = "Campaign History",
}: StudioCampaignHistorySheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<StudioCampaignHistoryItem[]>([]);

  async function loadHistory() {
    setLoading(true);
    setError(null);
    try {
      const result = await listStudioCampaignHistoryAction();
      if (!result.ok) {
        setError(result.message);
        setItems([]);
        return;
      }
      setItems(result.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load campaign history.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadHistory();
      }}
    >
      <SheetTrigger asChild>
        {triggerClassName ? (
          <button type="button" className={triggerClassName}>
            <HistoryIcon aria-hidden />
            {triggerLabel}
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-semibold"
          >
            <HistoryIcon className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{triggerLabel}</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-[380px]">
        <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-4 text-left">
          <SheetTitle className="text-base font-semibold">Campaign History</SheetTitle>
          <SheetDescription>
            Resume a campaign you already started in Studio.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Loading campaigns…</p>
          ) : error ? (
            <p className="px-2 py-8 text-center text-sm text-destructive">{error}</p>
          ) : (
            <StudioCampaignHistoryList
              items={items}
              activeConversationId={activeConversationId}
              onSelect={(item) => {
                setOpen(false);
                router.push(item.href);
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
