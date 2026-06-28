"use client";

import {
  ExternalLinkIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CreatorProfileLink,
  creatorProfileSourceFromUnified,
} from "@/components/creator/creator-profile-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { platformLabel } from "@/features/campaigns/line-assignment";
import { EnrichmentStatusBadge } from "@/features/discovery/enrichment/components/enrichment-status-badge";
import { resolveCreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";
import { PlatformIcon } from "@/lib/performance/platform-icon";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolvePrimaryProfileUrl } from "@/lib/discovery/profile-url";
import { cn } from "@/lib/utils";

import {
  audienceInterestList,
  brandSafetyMeta,
  countryFlag,
  formatCreatorCount,
  formatEngagementRate,
  thinkwayAiScore,
} from "./creator-search/creator-search-utils";

export const CREATOR_SEARCH_GRID_TEMPLATE =
  "40px minmax(0,1.7fr) 104px 92px 84px minmax(0,1.4fr) 80px 92px 108px 96px 88px 80px";
export const CREATOR_SHORTLIST_GRID_TEMPLATE =
  "40px minmax(0,1.7fr) 104px 92px 84px minmax(0,1.4fr) 80px 92px 108px 96px";
export const CREATOR_ROW_MIN_WIDTH = "md:min-w-[1268px]";
export const CREATOR_SHORTLIST_MIN_WIDTH = "md:min-w-[1060px]";

export function InterestChips({ interests }: { interests: string[] }) {
  if (interests.length === 0) {
    return <span className="text-[11px] text-muted-foreground/60">No interests tagged</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {interests.map((interest) => (
        <span
          key={interest}
          className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize"
        >
          {interest}
        </span>
      ))}
    </div>
  );
}

export function RelevanceScore({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const rounded = Math.round(score);
  const bars = Math.max(1, Math.min(4, Math.ceil((rounded / 100) * 4)));
  return (
    <div className="flex items-center gap-1.5" title={`Thinkway AI relevance ${rounded}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-full", i < bars ? "bg-primary" : "bg-primary/20")}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-primary">{rounded}</span>
    </div>
  );
}

export function PlatformCell({ creator }: { creator: UnifiedCreatorResult }) {
  const primary = creator.platforms[0];
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
      {primary ? (
        <>
          <PlatformIcon platform={primary.platform} size="xs" className="size-4 rounded-full" />
          <span className="truncate capitalize">{platformLabel(primary.platform)}</span>
        </>
      ) : (
        "—"
      )}
    </div>
  );
}

function SelectCell({
  rank,
  selected,
  displayName,
  onToggleSelect,
}: {
  rank: number;
  selected: boolean;
  displayName: string;
  onToggleSelect: () => void;
}) {
  return (
    <div className="relative flex w-5 shrink-0 items-center justify-center md:w-auto">
      {!selected ? (
        <span className="text-[11px] tabular-nums text-muted-foreground/70 group-hover:opacity-0">
          {rank}
        </span>
      ) : null}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={`${selected ? "Deselect" : "Select"} ${displayName}`}
        />
      </span>
    </div>
  );
}

function DefaultRowActions({
  creator,
  profileUrl,
  selected,
  onOpenCreator,
  onAddToList,
  onToggleSelect,
  addLabel = "Add",
}: {
  creator: UnifiedCreatorResult;
  profileUrl: string | null;
  selected: boolean;
  onOpenCreator: () => void;
  onAddToList?: () => void;
  onToggleSelect: () => void;
  addLabel?: string;
}) {
  const primary = creator.platforms[0];
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
        <DropdownMenuContent align="end" className="text-xs">
          {profileUrl ? (
            <DropdownMenuItem asChild>
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-3.5" />
                {primary ? `Open on ${platformLabel(primary.platform)}` : "Open profile"}
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={onOpenCreator}>View details</DropdownMenuItem>
          {onAddToList ? (
            <DropdownMenuItem onClick={onAddToList}>{addLabel} to list</DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={onToggleSelect}>
            {selected ? "Deselect" : "Select"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export type CreatorResultRowProps = {
  creator: UnifiedCreatorResult;
  rank: number;
  selected: boolean;
  variant?: "search" | "shortlist";
  onToggleSelect: () => void;
  onOpenCreator?: () => void;
  onAddToList?: () => void;
  addLabel?: string;
  statusBadge?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Shared Discovery creator row — used by Search and Shortlist workspaces. */
export function CreatorResultRow({
  creator,
  rank,
  selected,
  variant = "search",
  onToggleSelect,
  onOpenCreator,
  onAddToList,
  addLabel,
  statusBadge,
  actions,
  className,
}: CreatorResultRowProps) {
  const primary = creator.platforms[0];
  const profileUrl = resolvePrimaryProfileUrl(creator.platforms);
  const flag = countryFlag(creator.country_code);
  const safety = brandSafetyMeta(creator.authenticity_score);
  const aiScore = thinkwayAiScore(creator);
  const followers = formatCreatorCount(creator.metrics.followers.value);
  const avgEr = formatEngagementRate(creator.metrics.engagement_rate.value);
  const avgViews = formatCreatorCount(creator.metrics.avg_views.value);
  const enrichmentStatus = resolveCreatorEnrichmentStatus(creator.enrichment_status);
  const isShortlist = variant === "shortlist";
  const gridTemplate = isShortlist ? CREATOR_SHORTLIST_GRID_TEMPLATE : CREATOR_SEARCH_GRID_TEMPLATE;
  const minWidth = isShortlist ? CREATOR_SHORTLIST_MIN_WIDTH : CREATOR_ROW_MIN_WIDTH;

  const handleOpen = onOpenCreator ?? (() => undefined);
  const actionNode =
    actions ??
    (onOpenCreator || onAddToList ? (
      <DefaultRowActions
        creator={creator}
        profileUrl={profileUrl}
        selected={selected}
        onOpenCreator={handleOpen}
        onAddToList={onAddToList}
        onToggleSelect={onToggleSelect}
        addLabel={addLabel}
      />
    ) : null);

  return (
    <div
      role={onOpenCreator ? "button" : undefined}
      tabIndex={onOpenCreator ? 0 : undefined}
      onClick={onOpenCreator ? handleOpen : undefined}
      onKeyDown={
        onOpenCreator
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleOpen();
              }
            }
          : undefined
      }
      className={cn(
        "group border-b border-border transition-colors",
        onOpenCreator && "cursor-pointer hover:bg-muted/50",
        selected && "bg-primary/[0.06]",
        className
      )}
    >
      <div
        className={cn("hidden items-center gap-3 px-5 py-2.5 md:grid", minWidth)}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <SelectCell
          rank={rank}
          selected={selected}
          displayName={creator.display_name}
          onToggleSelect={onToggleSelect}
        />
        <CreatorProfileLink
          source={creatorProfileSourceFromUnified(creator)}
          size="lg"
          showExternalIcon
          stopPropagation
        />
        <PlatformCell creator={creator} />
        <div className="text-right text-[12px] font-semibold tabular-nums text-foreground">
          {followers}
        </div>
        <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
          {flag ? <span aria-hidden>{flag}</span> : null}
          <span>{creator.country_code ?? "—"}</span>
        </div>
        <div className="min-w-0">
          <InterestChips interests={audienceInterestList(creator).slice(0, 3)} />
        </div>
        <div className="text-right text-[12px] font-semibold tabular-nums text-foreground">
          {avgEr}
        </div>
        {!isShortlist ? (
          <>
            <div className="text-right text-[12px] tabular-nums text-muted-foreground">
              {avgViews}
            </div>
            <div>
              <RelevanceScore score={aiScore} />
            </div>
          </>
        ) : null}
        <div className={cn("text-[11px] font-medium", safety.className)}>{safety.label}</div>
        {!isShortlist ? (
          <div className="flex justify-end">
            <EnrichmentStatusBadge status={enrichmentStatus} className="text-[10px]" />
          </div>
        ) : null}
        {isShortlist ? <div className="min-w-0">{statusBadge}</div> : null}
        {!isShortlist ? actionNode : null}
        {isShortlist ? actionNode : null}
      </div>

      <div className="flex items-start gap-3 px-4 py-3 md:hidden">
        <SelectCell
          rank={rank}
          selected={selected}
          displayName={creator.display_name}
          onToggleSelect={onToggleSelect}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CreatorProfileLink
              source={creatorProfileSourceFromUnified(creator)}
              size="md"
              showExternalIcon
              stopPropagation
            />
            {actionNode}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className="flex items-center gap-1">
              {primary ? (
                <PlatformIcon
                  platform={primary.platform}
                  size="xs"
                  className="size-4 rounded-full"
                />
              ) : null}
              <span className="font-semibold tabular-nums text-foreground">{followers}</span>
              <span className="text-muted-foreground">followers</span>
            </span>
            {flag || creator.country_code ? (
              <span className="text-muted-foreground">
                {flag ? <span aria-hidden>{flag} </span> : null}
                {creator.country_code ?? ""}
              </span>
            ) : null}
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{avgEr}</span> ER
            </span>
            {!isShortlist ? (
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{avgViews}</span> views
              </span>
            ) : null}
          </div>
          <InterestChips interests={audienceInterestList(creator).slice(0, 4)} />
          <div className="flex items-center justify-between gap-3">
            {!isShortlist ? <RelevanceScore score={aiScore} /> : statusBadge}
            <div className="flex items-center gap-2">
              {!isShortlist ? (
                <EnrichmentStatusBadge status={enrichmentStatus} className="text-[10px]" />
              ) : null}
              <span className={cn("text-[10px] font-medium", safety.className)}>
                {safety.label} safety
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type HeaderColumn = {
  key: string;
  label: string;
  align?: "right";
  srOnly?: boolean;
};

const SEARCH_HEADER_COLUMNS: HeaderColumn[] = [
  { key: "rank", label: "#" },
  { key: "creator", label: "Creator" },
  { key: "platform", label: "Platform" },
  { key: "followers", label: "Followers", align: "right" },
  { key: "country", label: "Country" },
  { key: "interests", label: "Audience interests" },
  { key: "er", label: "Avg ER", align: "right" },
  { key: "views", label: "Avg views", align: "right" },
  { key: "relevance", label: "Relevance" },
  { key: "safety", label: "Brand safety" },
  { key: "sync", label: "Sync" },
  { key: "actions", label: "Actions", align: "right", srOnly: true },
];

const SHORTLIST_HEADER_COLUMNS: HeaderColumn[] = [
  { key: "select", label: "#" },
  { key: "creator", label: "Creator" },
  { key: "platform", label: "Platform" },
  { key: "followers", label: "Followers", align: "right" },
  { key: "country", label: "Country" },
  { key: "interests", label: "Audience interests" },
  { key: "er", label: "Avg ER", align: "right" },
  { key: "safety", label: "Brand safety" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", align: "right", srOnly: true },
];

export function CreatorResultGridHeader({ variant = "search" }: { variant?: "search" | "shortlist" }) {
  const columns = variant === "shortlist" ? SHORTLIST_HEADER_COLUMNS : SEARCH_HEADER_COLUMNS;
  const gridTemplate =
    variant === "shortlist" ? CREATOR_SHORTLIST_GRID_TEMPLATE : CREATOR_SEARCH_GRID_TEMPLATE;
  const minWidth = variant === "shortlist" ? CREATOR_SHORTLIST_MIN_WIDTH : CREATOR_ROW_MIN_WIDTH;

  return (
    <div
      role="row"
      className={cn(
        "sticky top-0 z-10 hidden items-center gap-3 border-b border-border bg-muted/60 px-5 py-2",
        "text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase md:grid",
        minWidth
      )}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          role="columnheader"
          className={cn("min-w-0 truncate", column.align === "right" && "text-right")}
        >
          {column.srOnly ? <span className="sr-only">{column.label}</span> : column.label}
        </div>
      ))}
    </div>
  );
}
