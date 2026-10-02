"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeIcon,
  GitMergeIcon,
  ListPlusIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { DeleteDiscoveryCreatorDialog } from "@/features/discovery/delete-creator/delete-discovery-creator-dialog";
import { CombineCreatorsDialog } from "@/features/discovery/components/combine-creators-dialog";
import { isEnrichmentInProgress, resolveCreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import { PlatformIcon, PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { cn } from "@/lib/utils";

/** Extracted from creator_action_menu_light.html / creator_action_menu.html */
const MENU = {
  width: "220px",
  radius: "12px",
  itemPadding: "11px 16px",
  itemGap: "12px",
  iconBadge: { size: "30px", radius: "8px", iconSize: "14px" },
  title: { size: "12px", weight: 600, marginBottom: "1px" },
  subtitle: { size: "10px" },
  trailingIcon: { size: "12px", strokeWidth: 2 },
  checkbox: { size: "16px", radius: "4px", borderWidth: "1.5px" },
  light: {
    bg: "#ffffff",
    border: "#e2e8f0",
    shadow: "0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.05)",
    divider: "#f1f5f9",
    title: "#0f172a",
    subtitle: "#94a3b8",
    trailingStroke: "#cbd5e1",
    checkboxBorder: "#e2e8f0",
    hover: "#f8fafc",
    active: "#f1f5f9",
    badges: {
      viewDetails: { bg: "#eff6ff", icon: "#3b82f6" },
      addToList: { bg: "#ecfdf5", icon: "#10b981" },
      select: { bg: "#fffbeb", icon: "#f59e0b" },
      stopRefresh: { bg: "#fff7ed", icon: "#f97316" },
      refreshMetrics: { bg: "#eff6ff", icon: "#3b82f6" },
      delete: { bg: "#fef2f2", icon: "#ef4444" },
    },
  },
  dark: {
    bg: "#0f1117",
    border: "rgba(255,255,255,0.1)",
    shadow: "0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
    divider: "rgba(255,255,255,0.06)",
    title: "#ffffff",
    subtitle: "rgba(255,255,255,0.35)",
    trailingStroke: "rgba(255,255,255,0.25)",
    checkboxBorder: "rgba(255,255,255,0.2)",
    hover: "rgba(255,255,255,0.05)",
    active: "rgba(255,255,255,0.08)",
    badges: {
      viewDetails: { bg: "rgba(99,102,241,0.15)", icon: "#818cf8" },
      addToList: { bg: "rgba(16,185,129,0.15)", icon: "#34d399" },
      select: { bg: "rgba(245,158,11,0.15)", icon: "#fbbf24" },
      stopRefresh: { bg: "rgba(249,115,22,0.15)", icon: "#fb923c" },
      refreshMetrics: { bg: "rgba(99,102,241,0.15)", icon: "#818cf8" },
      delete: { bg: "rgba(239,68,68,0.15)", icon: "#f87171" },
    },
  },
  instagramGradient: "linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)",
} as const;

type MenuBadgeVariant = "viewDetails" | "addToList" | "select" | "stopRefresh" | "refreshMetrics" | "delete";

type DiscoveryActionMenuItemProps = {
  title: string;
  subtitle: ReactNode;
  icon: ReactNode;
  iconStyle?: React.CSSProperties;
  iconClassName?: string;
  trailing?: "external" | "chevron" | "checkbox";
  checked?: boolean;
  showDivider?: boolean;
};

function DiscoveryActionMenuItem({
  title,
  subtitle,
  icon,
  iconStyle,
  iconClassName,
  trailing = "chevron",
  checked = false,
  showDivider = true,
}: DiscoveryActionMenuItemProps) {
  return (
    <span
      className={cn(
        "flex w-full items-center",
        showDivider && "border-b border-[#f1f5f9] dark:border-white/[0.06]"
      )}
      style={{ gap: MENU.itemGap, padding: MENU.itemPadding }}
    >
      <span
        className={cn("flex shrink-0 items-center justify-center", iconClassName)}
        style={{
          width: MENU.iconBadge.size,
          height: MENU.iconBadge.size,
          borderRadius: MENU.iconBadge.radius,
          ...iconStyle,
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className="block font-semibold text-[#0f172a] dark:text-white"
          style={{
            fontSize: MENU.title.size,
            marginBottom: MENU.title.marginBottom,
          }}
        >
          {title}
        </span>
        <span
          className="block text-[#94a3b8] dark:text-white/[0.35]"
          style={{ fontSize: MENU.subtitle.size }}
        >
          {subtitle}
        </span>
      </span>
      <span className="flex shrink-0 items-center justify-center">
        {trailing === "external" ? (
          <ExternalLinkIcon
            aria-hidden
            className="text-[#cbd5e1] dark:text-white/25"
            style={{ width: MENU.trailingIcon.size, height: MENU.trailingIcon.size }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ) : null}
        {trailing === "chevron" ? (
          <ChevronRightIcon
            aria-hidden
            className="text-[#cbd5e1] dark:text-white/25"
            style={{ width: MENU.trailingIcon.size, height: MENU.trailingIcon.size }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ) : null}
        {trailing === "checkbox" ? (
          <span
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center border-[#e2e8f0] dark:border-white/20",
              checked && "border-[#1D9E75] bg-[#1D9E75] text-white"
            )}
            style={{
              width: MENU.checkbox.size,
              height: MENU.checkbox.size,
              borderRadius: MENU.checkbox.radius,
              borderWidth: MENU.checkbox.borderWidth,
            }}
          >
            {checked ? (
              <CheckIcon
                style={{ width: "10px", height: "10px" }}
                strokeWidth={3}
              />
            ) : null}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const menuItemClassName = cn(
  "rounded-none px-0 py-0 text-sm font-normal outline-none transition-colors duration-100",
  "focus:bg-[#f8fafc] data-[highlighted]:bg-[#f8fafc] active:bg-[#f1f5f9]",
  "dark:focus:bg-white/[0.05] dark:data-[highlighted]:bg-white/[0.05] dark:active:bg-white/[0.08]"
);

function badgeClassName(variant: MenuBadgeVariant): string {
  return cn(
    variant === "viewDetails" && "bg-[#eff6ff] dark:bg-[rgba(99,102,241,0.15)]",
    variant === "addToList" && "bg-[#ecfdf5] dark:bg-[rgba(16,185,129,0.15)]",
    variant === "select" && "bg-[#fffbeb] dark:bg-[rgba(245,158,11,0.15)]",
    variant === "stopRefresh" && "bg-[#fff7ed] dark:bg-[rgba(249,115,22,0.15)]",
    variant === "refreshMetrics" && "bg-[#eff6ff] dark:bg-[rgba(99,102,241,0.15)]",
    variant === "delete" && "bg-[#fef2f2] dark:bg-[rgba(239,68,68,0.15)]"
  );
}

function iconColorClass(variant: MenuBadgeVariant): string {
  return cn(
    variant === "viewDetails" && "text-[#3b82f6] dark:text-[#818cf8]",
    variant === "addToList" && "text-[#10b981] dark:text-[#34d399]",
    variant === "select" && "text-[#f59e0b] dark:text-[#fbbf24]",
    variant === "stopRefresh" && "text-[#f97316] dark:text-[#fb923c]",
    variant === "refreshMetrics" && "text-[#3b82f6] dark:text-[#818cf8]",
    variant === "delete" && "text-[#ef4444] dark:text-[#f87171]"
  );
}

function MenuIcon({
  variant,
  children,
}: {
  variant: MenuBadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={iconColorClass(variant)}
      style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
    >
      {children}
    </span>
  );
}
function normalizePlatformKey(platform: string): string {
  const value = platform.trim().toLowerCase();
  if (value === "ig") return "instagram";
  if (value === "tt") return "tiktok";
  if (value === "yt") return "youtube";
  if (value === "fb") return "facebook";
  if (value === "sc") return "snapchat";
  return value;
}

function PlatformMenuIcon({ platform }: { platform: string }) {
  const key = normalizePlatformKey(platform);



  const style = PLATFORM_ICON_STYLES[key];
  if (style?.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={style.imageUrl}
        alt=""
        style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
        className="object-contain"
      />
    );
  }

  return <PlatformIcon platform={platform} size="xs" className="size-[14px] rounded-md" />;
}

function platformMenuIconStyle(platform: string): React.CSSProperties {
  const key = normalizePlatformKey(platform);
  if (PLATFORM_ICON_STYLES[key]?.imageUrl) return { background: "transparent", border: 0, boxShadow: "none" };
  const style = PLATFORM_ICON_STYLES[key];
  return style ? {} : { background: "#f1f5f9" };
}

function platformMenuIconClassName(platform: string): string {
  const key = normalizePlatformKey(platform);
  if (PLATFORM_ICON_STYLES[key]?.imageUrl) return "!bg-transparent !border-0 !shadow-none";
  return PLATFORM_ICON_STYLES[key]?.className ?? "bg-[#f1f5f9] dark:bg-white/10";
}

export type DiscoveryCreatorActionsMenuProps = {
  creator: UnifiedCreatorResult;
  profileUrl: string | null;
  selected: boolean;
  onOpenCreator: () => void;
  onAddToList?: () => void;
  onToggleSelect: () => void;
  onRefreshMetrics?: (platformAccountId?: string | null) => void;
  onStopRefresh?: () => void;
  onCreatorDeleted?: () => void;
  onCreatorUpdated?: (
    creator: UnifiedCreatorResult,
    meta?: { removedUnifiedId?: string; removedInfluencerId?: string | null }
  ) => void;
  addLabel?: string;
};

export function DiscoveryCreatorActionsMenu({
  creator,
  profileUrl,
  selected,
  onOpenCreator,
  onAddToList,
  onToggleSelect,
  onRefreshMetrics,
  onStopRefresh,
  onCreatorDeleted,
  onCreatorUpdated,
  addLabel = "Add",
}: DiscoveryCreatorActionsMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [combineOpen, setCombineOpen] = useState(false);
  const platforms = sortPlatformsStable(creator.platforms);
  const metricsPlatform =
    platforms.find((p) => p.id === creator.default_metrics_platform_account_id) ?? platforms[0];
  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const refreshInProgress = isEnrichmentInProgress(enrichmentStatus);
  const platformName = metricsPlatform ? platformLabel(metricsPlatform.platform) : "profile";
  const openTitle = metricsPlatform ? `Open on ${platformName}` : "Open profile";

  const menuItems: Array<{
    key: string;
    content: DiscoveryActionMenuItemProps;
    onSelect?: () => void;
    href?: string;
  }> = [];

  if (profileUrl) {
    menuItems.push({
      key: "open-profile",
      href: profileUrl,
      content: {
        title: openTitle,
        subtitle: (
          <>
            <span className="dark:hidden">View creator profile</span>
            <span className="hidden dark:inline">View profile</span>
          </>
        ),
        icon: metricsPlatform ? (
          <PlatformMenuIcon platform={metricsPlatform.platform} />
        ) : (
          <ExternalLinkIcon
            aria-hidden
            className="text-white"
            style={{ width: MENU.iconBadge.iconSize, height: MENU.iconBadge.iconSize }}
            strokeWidth={MENU.trailingIcon.strokeWidth}
          />
        ),
        iconStyle: metricsPlatform
          ? platformMenuIconStyle(metricsPlatform.platform)
          : { background: MENU.instagramGradient },
        iconClassName: metricsPlatform ? platformMenuIconClassName(metricsPlatform.platform) : undefined,
        trailing: "external",
      },
    });
  }

  menuItems.push({
    key: "view-details",
    onSelect: onOpenCreator,
    content: {
      title: "View details",
      subtitle: "Full creator profile",
      icon: (
        <MenuIcon variant="viewDetails">
          <EyeIcon strokeWidth={2} className="size-full" aria-hidden />
        </MenuIcon>
      ),
      iconClassName: badgeClassName("viewDetails"),
      trailing: "chevron",
    },
  });

  if (refreshInProgress && onStopRefresh) {
    menuItems.push({
      key: "stop-refresh",
      onSelect: onStopRefresh,
      content: {
        title: "Stop refresh",
        subtitle:
          enrichmentStatus === "queued"
            ? "Waiting in queue"
            : enrichmentStatus === "running"
              ? "Collecting metrics…"
              : "Cancel in-progress sync",
        icon: (
          <MenuIcon variant="stopRefresh">
            <Loader2Icon strokeWidth={2} className="size-full animate-spin" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("stopRefresh"),
        trailing: "chevron",
      },
    });
  } else if (onRefreshMetrics) {
    menuItems.push({
      key: "refresh-metrics-submenu",
      content: {
        title: "Refresh metrics",
        subtitle: "Update followers & engagement",
        icon: (
          <MenuIcon variant="refreshMetrics">
            <RefreshCwIcon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("refreshMetrics"),
        trailing: "chevron",
      },
    });
  }

  if (onAddToList) {
    menuItems.push({
      key: "add-to-list",
      onSelect: onAddToList,
      content: {
        title: `${addLabel} to list`,
        subtitle: "Save to shortlist",
        icon: (
          <MenuIcon variant="addToList">
            <PlusIcon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("addToList"),
        trailing: "chevron",
      },
    });
  }

  if (creator.influencer_id) {
    menuItems.push({
      key: "combine-creators",
      onSelect: () => setCombineOpen(true),
      content: {
        title: "Combine creators",
        subtitle: "Merge duplicate profile with another platform",
        icon: (
          <MenuIcon variant="addToList">
            <GitMergeIcon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("addToList"),
        trailing: "chevron",
      },
    });

    menuItems.push({
      key: "delete-creator",
      onSelect: () => setDeleteOpen(true),
      content: {
        title: "Delete from Discovery",
        subtitle: "Remove when not linked to campaigns or lists",
        icon: (
          <MenuIcon variant="delete">
            <Trash2Icon strokeWidth={2} className="size-full" aria-hidden />
          </MenuIcon>
        ),
        iconClassName: badgeClassName("delete"),
        trailing: "chevron",
      },
    });
  }

  menuItems.push({
    key: "select",
    onSelect: onToggleSelect,
    content: {
      title: selected ? "Deselect" : "Select",
      subtitle: selected ? "Remove from selection" : "Add to selection",
      icon: (
        <MenuIcon variant="select">
          <CheckIcon strokeWidth={2} className="size-full" aria-hidden />
        </MenuIcon>
      ),
      iconClassName: badgeClassName("select"),
      trailing: "checkbox",
      checked: selected,
    },
  });

  const lastIndex = menuItems.length - 1;

  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {onAddToList ? (
        <Button
          variant="ghost"
          size="sm"
          className="hidden h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary lg:inline-flex"
          onClick={onAddToList}
        >
          <ListPlusIcon className="size-3.5" />
          {addLabel}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className={cn(
            "min-w-0 overflow-hidden rounded-[12px] border border-[#e2e8f0] bg-white p-0 ring-0",
            "shadow-[0_4px_24px_rgba(15,23,42,0.08),0_1px_4px_rgba(15,23,42,0.05)]",
            "dark:border-white/10 dark:bg-[#0f1117]",
            "dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)]"
          )}
          style={{ width: MENU.width }}
        >
          {menuItems.map((item, index) => {
            const itemContent = {
              ...item.content,
              showDivider: index < lastIndex,
            };

            if (item.key === "refresh-metrics-submenu" && onRefreshMetrics) {
              return (
                <DropdownMenuSub key={item.key}>
                  <DropdownMenuSubTrigger className={menuItemClassName}>
                    <DiscoveryActionMenuItem {...itemContent} />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[180px] rounded-xl border border-border bg-popover p-1 shadow-lg">
                    {platforms.map((platform) => (
                      <DropdownMenuItem
                        key={platform.id}
                        className="gap-2 rounded-lg text-xs"
                        onSelect={() => onRefreshMetrics(platform.id)}
                      >
                        <PlatformIcon platform={platform.platform} size="xs" className="size-4 rounded-full" />
                        {platformLabel(platform.platform)}
                      </DropdownMenuItem>
                    ))}
                    {platforms.length > 1 ? (
                      <DropdownMenuItem
                        className="gap-2 rounded-lg text-xs font-medium"
                        onSelect={() => onRefreshMetrics(null)}
                      >
                        <RefreshCwIcon className="size-3.5" aria-hidden />
                        Refresh all
                      </DropdownMenuItem>
                    ) : platforms.length === 1 ? (
                      <DropdownMenuItem
                        className="gap-2 rounded-lg text-xs"
                        onSelect={() => onRefreshMetrics(platforms[0]!.id)}
                      >
                        <RefreshCwIcon className="size-3.5" aria-hidden />
                        Refresh
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            }

            if (item.href) {
              return (
                <DropdownMenuItem key={item.key} asChild className={menuItemClassName}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    <DiscoveryActionMenuItem {...itemContent} />
                  </a>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                key={item.key}
                className={menuItemClassName}
                onSelect={item.onSelect}
              >
                <DiscoveryActionMenuItem {...itemContent} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {creator.influencer_id ? (
        <DeleteDiscoveryCreatorDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          creator={creator}
          onDeleted={onCreatorDeleted}
        />
      ) : null}
      {creator.influencer_id ? (
        <CombineCreatorsDialog
          open={combineOpen}
          onOpenChange={setCombineOpen}
          targetCreator={creator}
          onMerged={(next, meta) =>
            onCreatorUpdated?.(next, {
              removedUnifiedId: meta.removedUnifiedId,
              removedInfluencerId: meta.removedInfluencerId,
            })
          }
        />
      ) : null}
    </div>
  );
}
