"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheckIcon } from "lucide-react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CountryFlagsStack } from "@/components/creator/country-flags-stack";
import { CreatorLinkedPlatformIcons } from "@/components/creator/creator-linked-platform-icons";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { formatThinkwayStarLabel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { shortlistCreatorSyncBorderClass } from "@/features/discovery/shortlists/components/shortlist-creator-meta-columns";
import { InterestChips } from "@/features/discovery/components/discovery-interest-chips";
import type { QuotationItemRow } from "@/features/quotations/types";
import { resolveQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import {
  loadCreatorPlatformOptions,
  unionQuotationCreatorGroupPlatforms,
} from "@/lib/quotations/quotation-creator-platform-options";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { cn } from "@/lib/utils";

type Props = {
  item: QuotationItemRow;
  /** All option lines for this creator — used to union platforms from types. */
  groupItems: QuotationItemRow[];
  /** Live platforms from option editors (updates before save). */
  livePlatforms?: string[];
  optionCount: number;
  isFirstGroup: boolean;
  hideOptionCount?: boolean;
  onOpenCreator?: () => void;
};

function formatHandle(handle: string | null | undefined): string | null {
  const trimmed = handle?.trim().replace(/^@+/, "");
  return trimmed ? `@${trimmed}` : null;
}

/** Visual separator + influencer identity (avatar, name) above that creator's option lines. */
export function QuotationCreatorGroupHeaderRow({
  item,
  groupItems,
  livePlatforms = [],
  optionCount,
  isFirstGroup,
  hideOptionCount = false,
  onOpenCreator,
}: Props) {
  const [fetchedPlatforms, setFetchedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadCreatorPlatformOptions(item).then((options) => {
      if (cancelled) return;
      setFetchedPlatforms(options.map((option) => option.platform));
    });
    return () => {
      cancelled = true;
    };
  }, [item.unified_id, item.influencer_id, item.profile_id, item.platform, item.handle]);

  const linkedPlatforms = useMemo(
    () =>
      unionQuotationCreatorGroupPlatforms(groupItems, [
        ...fetchedPlatforms,
        ...livePlatforms,
      ]),
    [groupItems, fetchedPlatforms, livePlatforms]
  );

  const creatorProfileSource = useMemo(
    () => resolveQuotationCreatorProfileSource(item, linkedPlatforms),
    [item, linkedPlatforms]
  );

  const creatorCategories = item.creator_categories ?? [];
  const countryCodes = resolveCreatorCountryCodes({
    country_codes: creatorProfileSource.countryCodes,
    country_code: creatorProfileSource.countryCode ?? item.country_code,
  });
  const profileUrl = resolveCreatorProfileUrl(creatorProfileSource);
  const handleLabel = formatHandle(creatorProfileSource.handle ?? item.handle);
  const displayName =
    creatorProfileSource.displayName?.trim() ||
    item.creator_name?.trim() ||
    handleLabel?.replace(/^@/, "") ||
    "Creator";
  const thinkwayScore = creatorProfileSource.thinkwayScore;
  const starLabel = formatThinkwayStarLabel(thinkwayScore);
  const avatarSyncClass = shortlistCreatorSyncBorderClass(
    creatorProfileSource.enrichmentDisplayStatus ?? "never"
  );

  const avatar = (
    <CreatorAvatarImage
      avatarUrl={creatorProfileSource.avatarUrl}
      profileUrl={profileUrl}
      alt={displayName}
      sizeClassName="size-[87px]"
      className="border-0 bg-[var(--surface,#f3f6fc)]"
    />
  );

  return (
    <div
      data-creator-detail-target
      className={cn(
        "cg-head",
        !isFirstGroup && "border-t border-[var(--line,#eaedf4)]"
      )}
    >
      <div
        className={cn(
          "shortlist-creator-exact-root quotation-cg-avatar-block shrink-0",
          avatarSyncClass
        )}
      >
        <div className="discovery-search-exact-photo-wrap">
          {profileUrl ? (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${displayName} profile`}
              className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0057FF]/40"
              onClick={(event) => event.stopPropagation()}
            >
              {avatar}
            </a>
          ) : (
            avatar
          )}
          {countryCodes.length > 0 ? (
            <span className="discovery-search-exact-flag">
              <CountryFlagsStack
                countryCodes={countryCodes}
                size="md"
                overlay
                className="size-full"
              />
            </span>
          ) : null}
          {thinkwayScore != null && Number.isFinite(thinkwayScore) ? (
            <span className="discovery-search-exact-star">★ {starLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="cg-id min-w-0 flex-1 self-center">
        <div className="cg-name">
          <span className="min-w-0 truncate">
            {onOpenCreator ? (
              <button
                type="button"
                className="max-w-full truncate text-left font-bold text-[var(--text)] hover:text-[var(--blue-text)] focus-visible:outline-none"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenCreator();
                }}
              >
                {displayName}
              </button>
            ) : (
              <span className="truncate font-bold text-[var(--text)]">
                {displayName}
              </span>
            )}
          </span>
          {creatorProfileSource.isVerified ? (
            <BadgeCheckIcon className="vf size-3.5 shrink-0 text-[var(--blue)]" aria-label="Verified" />
          ) : null}
          {linkedPlatforms.length > 0 ? (
            <CreatorLinkedPlatformIcons
              platforms={linkedPlatforms}
              className="shrink-0"
            />
          ) : null}
        </div>
        {handleLabel ? <div className="cg-handle truncate">{handleLabel}</div> : null}
        {creatorCategories.length > 0 ? (
          <div className="cg-cats">
            <InterestChips interests={creatorCategories} variant="icat" maxVisible={3} />
          </div>
        ) : null}
      </div>

      <div className="cg-foll shrink-0 self-center text-right">
        {item.followers != null ? (
          <>
            <b>{formatCreatorCount(item.followers)}</b>
            followers
          </>
        ) : null}
        {optionCount > 1 && !hideOptionCount ? (
          <span className="mt-1 block text-[11px] font-medium text-[var(--text)]">
            {optionCount} options
          </span>
        ) : null}
      </div>
    </div>
  );
}
