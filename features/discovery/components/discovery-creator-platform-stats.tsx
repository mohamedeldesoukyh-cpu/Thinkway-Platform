"use client";

import { PublicationPreviewImage } from "@/components/creator/publication-preview-image";
import type {
  CreatorRecentPublication,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { AB, PFC } from "@/lib/discovery/suite/helpers";
import { cn } from "@/lib/utils";

import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { formatEngagementRate } from "./creator-search/creator-search-utils";

function platformStatRowShowsHint(row: {
  metricsHint?: string | null;
  followers: number | null;
  engagement: number | null;
  avgViews: number | null;
}): boolean {
  return (
    Boolean(row.metricsHint) &&
    row.followers == null &&
    row.engagement == null &&
    row.avgViews == null
  );
}

function platformMark(platform: string | null): { cls: string; label: string } {
  const key = platform ? canonicalPlatformKey(platform) : "";
  const short =
    key === "instagram"
      ? "ig"
      : key === "tiktok"
        ? "tt"
        : key === "youtube"
          ? "yt"
          : key === "facebook"
            ? "fb"
            : key === "snapchat"
              ? "sc"
              : "ig";
  const d = PFC[short] ?? (["ig", "?"] as [string, string]);
  return { cls: d[0], label: d[1] };
}

function FeedThumb({ publication }: { publication: CreatorRecentPublication }) {
  return (
    <PublicationPreviewImage
      publication={publication}
      className="tw-thumb object-cover"
      placeholderClassName="tw-thumb"
      emptyGlyph=""
    />
  );
}

export function DiscoveryCreatorFeedThumbs({
  publications,
  maxItems,
}: {
  publications: CreatorRecentPublication[];
  /** Cap visible thumbs (pack shortlist = 3). */
  maxItems?: number;
}) {
  const visible =
    maxItems != null && maxItems > 0 ? publications.slice(0, maxItems) : publications;

  if (visible.length === 0) {
    return (
      <div className="tw-thumbs">
        <div className="tw-thumb" aria-hidden />
        <div className="tw-thumb" aria-hidden />
        <div className="tw-thumb" aria-hidden />
      </div>
    );
  }

  return (
    <div className="tw-thumbs">
      {visible.map((pub, index) => (
        <FeedThumb key={`${pub.url ?? "pub"}-${index}`} publication={pub} />
      ))}
    </div>
  );
}

export function DiscoveryCreatorPlatformStatsBox({
  creator,
  platformFilter,
  isApifyAcquired,
  platformStats: platformStatsProp,
}: {
  creator?: UnifiedCreatorResult;
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  platformStats?: ReturnType<typeof buildDiscoveryCreatorViewModel>["platformStats"];
}) {
  const platformStats =
    platformStatsProp ??
    (creator
      ? buildDiscoveryCreatorViewModel(creator, { platformFilter, isApifyAcquired }).platformStats
      : []);

  /** Always keep connected platforms — null metrics render as — (.z), never hide the row. */
  const rows =
    platformStats.length > 0
      ? platformStats
      : [
          {
            key: "empty",
            platform: null as string | null,
            followers: null,
            engagement: null,
            avgViews: null,
          },
        ];

  return (
    <div className="tw-stx">
      <span className="hh" aria-hidden>
        <i />
        <i>Followers</i>
        <i>Engagement</i>
        <i>Avg views</i>
      </span>
      {rows.map((row) => {
        const mark = platformMark(row.platform);
        const showHint = platformStatRowShowsHint(row);

        return (
          <span key={row.key} className="rr">
            <span className="tw-pf">
              <span className={mark.cls}>{mark.label}</span>
            </span>
            {showHint ? (
              <b className="z" style={{ gridColumn: "2 / -1", textAlign: "left" }} title={row.metricsHint ?? undefined}>
                {row.metricsHint}
              </b>
            ) : (
              <>
                <b className={cn(row.followers == null && "z")}>
                  {AB(row.followers)}
                </b>
                <b className={cn(row.engagement == null && "z")}>
                  {formatEngagementRate(row.engagement)}
                </b>
                <b className={cn(row.avgViews == null && "z")}>
                  {AB(row.avgViews)}
                </b>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}
