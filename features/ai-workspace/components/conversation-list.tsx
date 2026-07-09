"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  archiveConversationAction,
  deleteConversationAction,
  pinConversationAction,
  renameConversationAction,
} from "../actions/conversation-actions";
import type { ConversationListItem } from "../types";

type ConversationListProps = {
  conversations: ConversationListItem[];
  loading?: boolean;
  error?: string | null;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRefresh?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
};

export function ConversationList({
  conversations,
  loading,
  error,
  activeId,
  onSelect,
  onNewChat,
  onRefresh,
  collapsed = false,
  onCollapsedChange,
  className,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter((c) => c.isPinned);
  const recent = filtered.filter((c) => !c.isPinned);

  return (
    <aside
      className={cn(
        "ai-sidebar flex shrink-0 flex-col overflow-hidden border-r border-border bg-background",
        collapsed ? "w-12" : "w-64",
        className
      )}
    >
      {collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center py-3">
          <button
            type="button"
            onClick={() => onCollapsedChange?.(false)}
            title="Expand conversations"
            aria-label="Expand conversations"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors",
              "hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
            )}
          >
            <ChevronRightIcon className="size-4" />
          </button>

          <button
            type="button"
            onClick={onNewChat}
            title="New chat"
            aria-label="New chat"
            className={cn(
              "mt-2 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors",
              "hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
            )}
          >
            <PlusIcon className="size-3.5" />
          </button>

          <div className="mt-auto flex flex-col items-center gap-1 pb-1">
            <MessageSquareIcon className="size-4 text-muted-foreground/40" aria-hidden />
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-border px-3.5 pt-3.5 pb-3">
            <button
              type="button"
              onClick={onNewChat}
              className={cn(
                "mb-2.5 flex h-[34px] w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 text-xs font-semibold text-foreground/80 transition-colors",
                "hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700",
                "dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
              )}
            >
              <PlusIcon className="size-3" />
              New chat
            </button>

            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-[30px] rounded-md border-border bg-muted/50 pr-2.5 pl-7 text-xs"
              />
            </div>
          </div>

          {error ? (
            <p className="px-3 py-4 text-center text-xs text-destructive">{error}</p>
          ) : null}

          {loading && conversations.length === 0 ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {pinned.length > 0 ? (
                <ConversationGroup
                  label="Pinned"
                  items={pinned}
                  activeId={activeId}
                  onSelect={onSelect}
                  onRefresh={onRefresh}
                />
              ) : null}
              {recent.length > 0 ? (
                <ConversationGroup
                  label="Recent"
                  items={recent}
                  activeId={activeId}
                  onSelect={onSelect}
                  onRefresh={onRefresh}
                />
              ) : null}
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-7 text-center text-xs text-muted-foreground">
                  <MessageSquareIcon className="size-[22px] opacity-35" />
                  No conversations yet
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No matching conversations
                </p>
              ) : null}
            </div>
          )}

          {onCollapsedChange ? (
            <div className="shrink-0 border-t border-border p-2">
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                className={cn(
                  "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors",
                  "hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <ChevronLeftIcon className="size-3.5" />
                Collapse
              </button>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}

function ConversationGroup({
  label,
  items,
  activeId,
  onSelect,
  onRefresh,
}: {
  label: string;
  items: ConversationListItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <ConversationRow
            key={item.id}
            item={item}
            isActive={item.id === activeId}
            onSelect={onSelect}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

function ConversationRow({
  item,
  isActive,
  onSelect,
  onRefresh,
}: {
  item: ConversationListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(item.title);

  async function handleRename() {
    if (title.trim() && title !== item.title) {
      await renameConversationAction(item.id, title.trim());
      onRefresh?.();
    }
    setRenaming(false);
  }

  const formattedDate = new Date(item.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={cn(
        "group flex items-center gap-0.5 rounded-[7px] pr-0.5 transition-colors",
        isActive
          ? "bg-violet-50 dark:bg-violet-950/30"
          : "hover:bg-muted/60"
      )}
    >
      {renaming ? (
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void handleRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          className="mx-1 h-8 flex-1 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="min-w-0 flex-1 px-2.5 py-2 text-left"
        >
          <div
            className={cn(
              "truncate text-xs font-medium",
              isActive ? "font-semibold text-violet-700 dark:text-violet-300" : "text-foreground"
            )}
          >
            {item.isPinned ? (
              <PinIcon className="mr-1 inline size-3 shrink-0 text-violet-500" />
            ) : null}
            {item.title}
          </div>
          <div className="text-[10px] text-muted-foreground">{formattedDate}</div>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100"
            aria-label="Conversation options"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              await pinConversationAction(item.id, !item.isPinned);
              onRefresh?.();
            }}
          >
            <PinIcon className="size-4" />
            {item.isPinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              await archiveConversationAction(item.id, item.status !== "archived");
              onRefresh?.();
            }}
          >
            <ArchiveIcon className="size-4" />
            {item.status === "archived" ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={async () => {
              await deleteConversationAction(item.id);
              onRefresh?.();
            }}
          >
            <Trash2Icon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
