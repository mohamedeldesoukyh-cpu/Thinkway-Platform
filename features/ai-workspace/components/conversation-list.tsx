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

/** Date buckets for the sidebar — mirrors the reference Studio design. */
function bucketLabel(updatedAt: string): string {
  const updated = new Date(updatedAt);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.floor(
    (startOfDay(now).getTime() - startOfDay(updated).getTime()) / 86_400_000
  );
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return "This week";
  return "Earlier";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "Earlier"] as const;

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
  const rest = filtered.filter((c) => !c.isPinned);
  const buckets = new Map<string, ConversationListItem[]>();
  for (const item of rest) {
    const label = bucketLabel(item.updatedAt);
    const list = buckets.get(label) ?? [];
    list.push(item);
    buckets.set(label, list);
  }

  return (
    <aside
      className={cn(
        "ai-sidebar ai-sidebar-glass ai-sidebar-float flex shrink-0 flex-col self-stretch overflow-hidden",
        collapsed ? "w-12" : "w-[272px]",
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
            className="flex size-8 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-[#0057FF]/[0.08] hover:text-foreground"
          >
            <ChevronRightIcon className="size-4" />
          </button>

          <button
            type="button"
            onClick={onNewChat}
            title="New chat"
            aria-label="New chat"
            className="mt-2 flex size-8 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-[#0057FF]/[0.08] hover:text-foreground"
          >
            <PlusIcon className="size-3.5" />
          </button>

          <div className="mt-auto flex flex-col items-center gap-1 pb-1">
            <MessageSquareIcon className="size-4 text-foreground/30" aria-hidden />
          </div>
        </div>
      ) : (
        <>
          <div className="px-3.5 pt-4 pb-2">
            <button
              type="button"
              onClick={onNewChat}
              className="ai-btn-new flex h-[42px] w-full items-center justify-center gap-2 rounded-[14px] text-sm font-semibold text-white"
            >
              <PlusIcon className="size-4" strokeWidth={2.4} />
              New chat
            </button>

            <div className="relative mt-3">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-foreground/40" />
              <Input
                placeholder="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "h-[38px] rounded-xl border-black/[0.08] bg-white/60 pr-2.5 pl-9 text-[13px] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
                  "placeholder:text-foreground/40",
                  "focus-visible:border-[#0057FF]/45 focus-visible:ring-[#0057FF]/25"
                )}
              />
            </div>
          </div>

          {error ? (
            <p className="px-3 py-4 text-center text-xs text-destructive">{error}</p>
          ) : null}

          {loading && conversations.length === 0 ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg bg-[#0057FF]/10" />
              ))}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-2">
              {pinned.length > 0 ? (
                <ConversationGroup
                  label="Pinned"
                  items={pinned}
                  activeId={activeId}
                  onSelect={onSelect}
                  onRefresh={onRefresh}
                />
              ) : null}
              {BUCKET_ORDER.map((label) => {
                const items = buckets.get(label);
                if (!items || items.length === 0) return null;
                return (
                  <ConversationGroup
                    key={label}
                    label={label}
                    items={items}
                    activeId={activeId}
                    onSelect={onSelect}
                    onRefresh={onRefresh}
                  />
                );
              })}
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-7 text-center text-xs text-foreground/50">
                  <MessageSquareIcon className="size-[22px] opacity-40" />
                  No conversations yet
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-foreground/50">
                  No matching conversations
                </p>
              ) : null}
            </div>
          )}

          {onCollapsedChange ? (
            <div className="shrink-0 border-t border-black/[0.06] p-2">
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-foreground/55 transition-colors hover:bg-[#0057FF]/[0.08] hover:text-foreground"
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
      <p className="px-2.5 pt-3.5 pb-2 text-[10.5px] font-bold tracking-[1px] text-foreground/45 uppercase">
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
        "group relative flex items-center gap-0.5 rounded-[10px] pr-0.5 transition-colors",
        isActive ? "ai-nav-item-active" : "hover:bg-[#0057FF]/[0.06]"
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
          className="mx-1 h-8 flex-1 border-black/[0.1] bg-white/70 text-xs text-foreground"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="min-w-0 flex-1 px-2.5 py-2 text-left"
        >
          <div
            className={cn(
              "truncate text-[13px]",
              isActive ? "font-semibold text-[#0057FF]" : "font-medium text-foreground/85"
            )}
          >
            {item.isPinned ? (
              <PinIcon className="mr-1 inline size-3 shrink-0 text-[#0057FF]" />
            ) : null}
            {item.title}
          </div>
          <div className="text-[11px] text-foreground/45">{formattedDate}</div>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-foreground/50 opacity-0 group-hover:opacity-100 hover:bg-[#0057FF]/[0.08] hover:text-foreground"
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
