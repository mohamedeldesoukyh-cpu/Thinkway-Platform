"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { memo, type MouseEvent, type ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import {
  DiscoveryCreatorFeedThumbs,
  DiscoveryCreatorPlatformStatsBox,
} from "@/features/discovery/components/discovery-creator-platform-stats";
import {
  buildDiscoveryCreatorViewModel,
  resolveDiscoveryCreatorMetaLabel,
} from "@/features/discovery/view-models/discovery-creator-view-model";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { CreatorAvatarHoverTrigger } from "./creator-search/creator-avatar-hover-trigger";

/** @deprecated Use resolveDiscoveryCreatorMetaLabel from discovery-creator-view-model */
export { resolveDiscoveryCreatorMetaLabel as resolveExactRowCategoriesLabel };

export type DiscoveryCreatorExactRowProps = {
  creator: UnifiedCreatorResult;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenCreator: () => void;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  workerOfflineHint?: boolean;
  showCampaignRelevance?: boolean;
  className?: string;
  enriching?: boolean;
  selectable?: boolean;
  showFeed?: boolean;
  /** Search workspace — shortlist add state */
  addedToShortlist?: boolean;
  onToggleShortlist?: () => void;
  onReject?: () => void;
  /** Override default search accept/reject actions */
  actions?: ReactNode;
  /** Workspace meta (status, sync, quoted, etc.) between feed and actions */
  meta?: ReactNode;
  /** Split tier + status + quoted columns (shortlist) — aligns headers with row cells */
  metaColumns?: { tier: ReactNode; status: ReactNode; quoted: ReactNode };
  /** Compact label in the left creator column (e.g. Quoted). */
  infoBadge?: ReactNode;
  /** Cap feed thumbs (shortlist uses 2). Defaults to all publications. */
  feedMaxItems?: number;
  /** Row click opens creator detail (Search) or toggles selection (shortlist) */
  rowBehavior?: "open-detail" | "toggle-select";
  /** Category chip density — compact/icat for shortlist rows. */
  interestChipVariant?: "default" | "compact" | "icat";
};

export const DiscoveryCreatorExactRow = memo(function DiscoveryCreatorExactRow({
  creator,
  selected,
  addedToShortlist = false,
  platformFilter,
  isApifyAcquired,
  workerOfflineHint,
  showCampaignRelevance = false,
  onToggleSelect,
  onOpenCreator,
  onToggleShortlist,
  onReject,
  className,
  enriching = false,
  selectable = true,
  showFeed = true,
  actions,
  meta,
  metaColumns,
  infoBadge,
  feedMaxItems,
  rowBehavior = "open-detail",
  interestChipVariant = "default",
}: DiscoveryCreatorExactRowProps) {
  const vm = buildDiscoveryCreatorViewModel(creator, {
    platformFilter,
    isApifyAcquired,
    showCampaignRelevance,
  });

  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const searchActions =
    actions ??
    (onToggleShortlist || onReject ? (
      <>
        {onToggleShortlist ? (
          <button
            type="button"
            className={cn(
              "discovery-search-exact-accept",
              addedToShortlist && "is-added"
            )}
            onClick={(event) => {
              stop(event);
              onToggleShortlist();
            }}
          >
            <CheckIcon aria-hidden />
            <span>{addedToShortlist ? "Added" : "Add to shortlist"}</span>
          </button>
        ) : null}
        {onReject ? (
          <button
            type="button"
            className="discovery-search-exact-reject"
            aria-label={`Delete ${vm.displayName}`}
            onClick={(event) => {
              stop(event);
              onReject();
            }}
          >
            <XIcon aria-hidden />
          </button>
        ) : null}
      </>
    ) : null);

  const handleRowActivate = () => {
    if (rowBehavior === "toggle-select") {
      onToggleSelect();
      return;
    }
    onOpenCreator();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleRowActivate();
        }
      }}
      className={cn(
        "discovery-search-exact-row",
        selected && "is-selected",
        enriching && "discovery-search-exact-row--enriching",
        meta && "discovery-search-exact-row--with-meta",
        metaColumns && "discovery-search-exact-row--with-meta",
        className
      )}
      data-discovery-creator-target
    >
      <div className="discovery-search-exact-photo-cell">
        {selectable ? (
          <span className="discovery-search-exact-select" onClick={stop}>
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label={`${selected ? "Deselect" : "Select"} ${vm.displayName}`}
            />
          </span>
        ) : null}
        <CreatorAvatarHoverTrigger
          creator={creator}
          displayName={vm.displayName}
          avatarUrl={vm.avatarUrl}
          profileUrl={vm.profileUrl}
          thinkwayStarLabel={vm.thinkwayStarLabel}
          fallbackStatusLabel={vm.updatedLabel}
          onOpenCreator={onOpenCreator}
          className="discovery-search-exact-photo-wrap"
        >
          {vm.profileUrl ? (
            <a
              href={vm.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${vm.displayName} profile`}
              className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF]/40"
              onClick={stop}
            >
              <CreatorAvatarImage
                avatarUrl={vm.avatarUrl}
                profileUrl={vm.profileUrl}
                alt={vm.displayName}
                sizeClassName="size-[87px]"
                className="border-0 bg-[var(--surface,#f3f6fc)]"
              />
            </a>
          ) : (
            <CreatorAvatarImage
              avatarUrl={vm.avatarUrl}
              profileUrl={vm.profileUrl}
              alt={vm.displayName}
              sizeClassName="size-[87px]"
              className="border-0 bg-[var(--surface,#f3f6fc)]"
            />
          )}
          {vm.countryFlagCodes.length > 0 ? (
            <span className="discovery-search-exact-flag">
              <CountryFlagsStack
                countryCodes={vm.countryFlagCodes}
                size="md"
                overlay
                className="size-full"
              />
            </span>
          ) : null}
          <span className="discovery-search-exact-star">★ {vm.thinkwayStarLabel}</span>
        </CreatorAvatarHoverTrigger>
      </div>

      <div className="discovery-search-exact-info-cell">
        <div className="discovery-search-exact-info-stack">
          <button
            type="button"
            className="discovery-search-exact-name nm max-w-full min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-[inherit]"
            title={vm.displayName}
            onClick={(event) => {
              stop(event);
              onOpenCreator();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                stop(event);
                onOpenCreator();
              }
            }}
          >
            {vm.displayName}
          </button>
          {vm.handleLabel ? (
            <div className="discovery-search-exact-handle" title={vm.handleLabel}>
              {vm.handleLabel}
            </div>
          ) : null}
          {infoBadge ? (
            <div className="discovery-search-exact-info-badges" onClick={stop}>
              {infoBadge}
            </div>
          ) : null}
          {vm.countryLabel !== "—" ? (
            <div className="discovery-search-exact-handle text-[11px] text-muted-foreground" title={vm.countryLabel}>
              {vm.countryLabel}
            </div>
          ) : null}
        </div>
      </div>

      {metaColumns ? (
        <div className="discovery-search-exact-tier-cell" onClick={stop}>
          {metaColumns.tier}
        </div>
      ) : null}

      <div className="discovery-search-exact-category-cell">
        <InterestChips
          interests={vm.categories}
          emptyLabel="No categories"
          variant={interestChipVariant === "default" ? "default" : interestChipVariant}
          maxVisible={interestChipVariant === "icat" ? 2 : interestChipVariant === "compact" ? 2 : 3}
        />
      </div>

      <DiscoveryCreatorPlatformStatsBox platformStats={vm.platformStats} />

      {showFeed ? (
        <DiscoveryCreatorFeedThumbs
          publications={vm.feedPublications}
          maxItems={feedMaxItems}
        />
      ) : null}

      {metaColumns ? (
        <>
          <div className="discovery-search-exact-status-cell" onClick={stop}>
            {metaColumns.status}
          </div>
          <div className="discovery-search-exact-quoted-cell" onClick={stop}>
            {metaColumns.quoted}
          </div>
        </>
      ) : meta ? (
        <div className="discovery-search-exact-meta-cell" onClick={stop}>
          {meta}
        </div>
      ) : null}

      {searchActions ? (
        <div className="discovery-search-exact-actions" onClick={stop}>
          {searchActions}
        </div>
      ) : null}
    </div>
  );
});

/** @deprecated Use DiscoveryCreatorExactRow */
export const CreatorSearchExactRow = DiscoveryCreatorExactRow;
/** @deprecated Use DiscoveryCreatorExactRowProps */
export type CreatorSearchExactRowProps = DiscoveryCreatorExactRowProps;

export function DiscoveryCreatorExactHeader({
  total,
  allSelected,
  hasCreators,
  onToggleSelectAll,
  toolbar,
  metaLabel,
  metaColumns,
  countLabel,
  showSelectAll = true,
  reserveActionsColumn = false,
  headersClassName,
  infoColumnLabel = "Creator Name",
}: {
  total: number;
  allSelected: boolean | "indeterminate";
  hasCreators: boolean;
  onToggleSelectAll: () => void;
  toolbar?: ReactNode;
  metaLabel?: ReactNode;
  metaColumns?: { tier: ReactNode; status: ReactNode; quoted: ReactNode };
  countLabel?: string;
  showSelectAll?: boolean;
  /** Reserve width for row action menu so meta columns align with body rows. */
  reserveActionsColumn?: boolean;
  headersClassName?: string;
  infoColumnLabel?: string;
}) {
  const resolvedCountLabel =
    countLabel ?? `${total.toLocaleString()} Creator${total === 1 ? "" : "s"}`;

  return (
    <div className={cn("discovery-search-exact-headers", headersClassName)}>
      <div className="discovery-search-exact-col-count">
        {showSelectAll ? (
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all loaded creators"
            disabled={!hasCreators}
          />
        ) : null}
        <span className="discovery-search-exact-col-count-label">{resolvedCountLabel}</span>
      </div>
      <span className="discovery-search-exact-col-info">{infoColumnLabel}</span>
      {metaColumns ? (
        <span className="discovery-search-exact-col-tier">{metaColumns.tier}</span>
      ) : null}
      <span className="discovery-search-exact-col-category">Category</span>
      <span className="discovery-search-exact-col-stats">Statistics</span>
      <div className="discovery-search-exact-col-feed">
        <span>Content from feed</span>
        {toolbar}
      </div>
      {metaColumns ? (
        <>
          <span className="discovery-search-exact-col-status">{metaColumns.status}</span>
          <span className="discovery-search-exact-col-quoted">{metaColumns.quoted}</span>
        </>
      ) : metaLabel ? (
        <span className="discovery-search-exact-col-meta">{metaLabel}</span>
      ) : null}
      {reserveActionsColumn ? (
        <span className="discovery-search-exact-col-actions" aria-hidden />
      ) : null}
    </div>
  );
}

/** @deprecated Use DiscoveryCreatorExactHeader */
export const CreatorSearchExactHeader = DiscoveryCreatorExactHeader;
