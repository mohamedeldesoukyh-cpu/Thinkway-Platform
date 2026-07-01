"use client";

import { XIcon } from "lucide-react";

import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { creatorProfileSourceFromUnified } from "@/components/creator/creator-profile-link";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

type Props = {
  creators: UnifiedCreatorResult[];
  onRemove: (unifiedId: string) => void;
  className?: string;
};

/** Compact removable chips for creators selected in the add-creators panel. */
export function CreatorSelectionPreview({ creators, onRemove, className }: Props) {
  if (creators.length === 0) return null;

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border bg-slate-50/80 px-4 py-2.5",
        className
      )}
    >
      <p className="mb-2 text-[11px] font-medium text-muted-foreground">Selected</p>
      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {creators.map((creator) => {
          const source = creatorProfileSourceFromUnified(creator);
          return (
            <span
              key={creator.unified_id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-white py-1 pl-1 pr-1.5 text-xs shadow-sm"
            >
              <CreatorThumbAvatar
                name={source.displayName}
                avatarUrl={source.avatarUrl}
                platform={source.platform}
                size={20}
                shape="circle"
              />
              <span className="max-w-[120px] truncate font-medium text-foreground">
                {source.displayName}
              </span>
              <button
                type="button"
                onClick={() => onRemove(creator.unified_id)}
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${source.displayName}`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
