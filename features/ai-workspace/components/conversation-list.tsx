"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  CircleDollarSignIcon,
  HomeIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  archiveConversationAction,
  deleteConversationAction,
  pinConversationAction,
  renameConversationAction,
} from "../actions/conversation-actions";
import { STUDIO_CHAT_CLASSES } from "../constants/studio-chat-tokens";
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
  /** Sheet / overlay — full width, no collapse rail. */
  embedded?: boolean;
  className?: string;
};

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

function convoIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("vendor") || lower.includes("sooh") || lower.includes("quote")) {
    return HomeIcon;
  }
  if (lower.includes("egp") || lower.includes("budget") || lower.includes("$")) {
    return CircleDollarSignIcon;
  }
  if (lower.includes("campaign") || lower.includes("push") || lower.includes("brief")) {
    return ZapIcon;
  }
  return MessageSquareIcon;
}

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
  embedded = false,
  className,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const confirmDelete = useConfirmDelete();

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

  const Root = embedded ? "div" : "aside";

  return (
    <Root
      className={cn(
        STUDIO_CHAT_CLASSES.sidebar,
        collapsed && STUDIO_CHAT_CLASSES.sidebarCollapsed,
        embedded && "w-full",
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
            className="sc-collapse-btn flex size-8 items-center justify-center rounded-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={onNewChat}
            title="New chat"
            aria-label="New chat"
            className="mt-2 flex size-8 items-center justify-center rounded-lg text-[var(--sc-text-3)] transition-colors hover:bg-[rgba(0,87,255,0.05)]"
          >
            <PlusIcon className="size-3.5" strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <>
          <div className="sc-sidebar-top">
            <button type="button" onClick={onNewChat} className={STUDIO_CHAT_CLASSES.newChatBtn}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>New chat</span>
            </button>

            <div className="sc-search-wrap">
              <SearchIcon strokeWidth={2} />
              <input
                type="text"
                placeholder="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sc-search-input"
              />
            </div>
          </div>

          {error ? <p className="sc-sidebar-empty text-destructive">{error}</p> : null}

          {loading && conversations.length === 0 ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="sc-convo-scroll">
              {pinned.length > 0 ? (
                <ConversationGroup
                  label="Pinned"
                  items={pinned}
                  activeId={activeId}
                  onSelect={onSelect}
                  onRefresh={onRefresh}
                  confirmDelete={confirmDelete}
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
                    confirmDelete={confirmDelete}
                  />
                );
              })}
              {conversations.length === 0 ? (
                <div className="sc-sidebar-empty">
                  <MessageSquareIcon className="mx-auto mb-2 size-[22px] opacity-40" />
                  No conversations yet
                </div>
              ) : filtered.length === 0 ? (
                <p className="sc-sidebar-empty">No matching conversations</p>
              ) : null}
            </div>
          )}

          {onCollapsedChange && !embedded ? (
            <div className="sc-sidebar-foot">
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                className="sc-collapse-btn"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <path d="M15 6l-6 6 6 6" />
                </svg>
                <span>Collapse</span>
              </button>
            </div>
          ) : null}
        </>
      )}
    </Root>
  );
}

function ConversationGroup({
  label,
  items,
  activeId,
  onSelect,
  onRefresh,
  confirmDelete,
}: {
  label: string;
  items: ConversationListItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
  confirmDelete: (description: string, title?: string) => Promise<boolean>;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="sc-convo-group-label">{label}</p>
      {items.map((item) => (
        <ConversationRow
          key={item.id}
          item={item}
          isActive={item.id === activeId}
          onSelect={onSelect}
          onRefresh={onRefresh}
          confirmDelete={confirmDelete}
        />
      ))}
    </div>
  );
}

function ConversationRow({
  item,
  isActive,
  onSelect,
  onRefresh,
  confirmDelete,
}: {
  item: ConversationListItem;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
  confirmDelete: (description: string, title?: string) => Promise<boolean>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(item.title);
  const Icon = convoIcon(item.title);

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
        STUDIO_CHAT_CLASSES.convoItem,
        isActive && STUDIO_CHAT_CLASSES.convoItemActive,
        "group"
      )}
    >
      {renaming ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void handleRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          className="mx-1 h-8 min-w-0 flex-1 rounded-md border border-[var(--sc-border)] bg-white px-2 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span className="sc-convo-ico">
            <Icon strokeWidth={2} />
          </span>
          <span className="sc-convo-body">
            <span className="sc-convo-title">
              {item.isPinned ? (
                <PinIcon className="mr-1 inline size-3 shrink-0 text-[var(--sc-blue)]" />
              ) : null}
              {item.title}
            </span>
            <span className="sc-convo-date">{formattedDate}</span>
          </span>
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[var(--sc-text-3)] opacity-0 group-hover:opacity-100"
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
              const ok = await confirmDelete(
                `Delete "${item.title}"? This conversation and its messages will be permanently removed.`,
                "Delete conversation?"
              );
              if (!ok) return;
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
