"use client";

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
import { cn } from "@/lib/utils";

import type { ConversationListItem } from "../types";
import { ConversationList } from "./conversation-list";

type ConversationHistorySheetProps = {
  conversations: ConversationListItem[];
  loading?: boolean;
  error?: string | null;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRefresh?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

export function ConversationHistorySheet({
  conversations,
  loading,
  error,
  activeId,
  onSelect,
  onNewChat,
  onRefresh,
  open,
  onOpenChange,
  className,
}: ConversationHistorySheetProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange?.(false);
  };

  const handleNewChat = () => {
    onNewChat();
    onOpenChange?.(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-lg border-black/[0.08] bg-white/80 px-2.5 text-xs font-semibold text-foreground shadow-sm hover:bg-[#0057FF]/[0.06] hover:text-[#0057FF] dark:border-border dark:bg-background",
            className
          )}
        >
          <HistoryIcon className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">History</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[320px]"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-4 text-left">
          <SheetTitle className="text-base font-semibold">Conversations</SheetTitle>
          <SheetDescription>Browse and switch between past AI chats.</SheetDescription>
        </SheetHeader>
        <ConversationList
          embedded
          conversations={conversations}
          loading={loading}
          error={error}
          activeId={activeId}
          onSelect={handleSelect}
          onNewChat={handleNewChat}
          onRefresh={onRefresh}
          className="min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none"
        />
      </SheetContent>
    </Sheet>
  );
}
