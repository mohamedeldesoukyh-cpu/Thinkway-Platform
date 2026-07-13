"use client";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ConversationListItem } from "../types";
import { ConversationHistorySheet } from "./conversation-history-sheet";

type StudioConversationControlsProps = {
  conversations: ConversationListItem[];
  loading?: boolean;
  error?: string | null;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRefresh?: () => void;
  className?: string;
};

export function StudioConversationControls({
  conversations,
  loading,
  error,
  activeId,
  onSelect,
  onNewChat,
  onRefresh,
  className,
}: StudioConversationControlsProps) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <Button
        type="button"
        size="sm"
        onClick={onNewChat}
        className="h-8 gap-1.5 rounded-lg bg-[#0057FF] px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0046CC]"
      >
        <PlusIcon className="size-3.5" strokeWidth={2.4} aria-hidden />
        <span className="hidden sm:inline">New chat</span>
        <span className="sm:hidden">New</span>
      </Button>
      <ConversationHistorySheet
        conversations={conversations}
        loading={loading}
        error={error}
        activeId={activeId}
        onSelect={onSelect}
        onNewChat={onNewChat}
        onRefresh={onRefresh}
      />
    </div>
  );
}
