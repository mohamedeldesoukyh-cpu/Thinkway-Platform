"use client";

import { useMediaProxyImageRecovery } from "@/hooks/use-media-proxy-image-recovery";
import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";
import type {
  CreatorRecentPublication,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { PlatformIcon } from "@/lib/performance/platform-icon";

import { buildDiscoveryCreatorViewModel } from "@/features/discovery/view-models/discovery-creator-view-model";
import { formatCreatorCount, formatEngagementRate } from "./creator-search/creator-search-utils";

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

function FeedThumb({ publication }: { publication: CreatorRecentPublication }) {
  const src = creatorRecentPublicationDisplayUrl(publication);
  const recovery = useMediaProxyImageRecovery(src);

  if (!src || recovery.exhausted) {
    return <div className="discovery-search-exact-feed-thumb discovery-search-exact-feed-thumb--empty" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={recovery.displaySrc ?? src}
      src={recovery.displaySrc ?? src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className="discovery-search-exact-feed-thumb"
      onError={recovery.onError}
    />
  );
}

export function DiscoveryCreatorFeedThumbs({
  publications,
  maxItems,
}: {
  publications: CreatorRecentPublication[];
  /** Cap visible thumbs (e.g. shortlist uses 2 to free column space). */
  maxItems?: number;
}) {
  const visible =
    maxItems != null && maxItems > 0 ? publications.slice(0, maxItems) : publications;

  if (visible.length === 0) {
    return (
      <div className="discovery-search-exact-feed-thumbs discovery-search-exact-feed-thumbs--empty">
        <div className="discovery-search-exact-feed-thumb discovery-search-exact-feed-thumb--empty" />
      </div>
    );
  }

  return (
    <div className="discovery-search-exact-feed-thumbs">
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
    <div className="discovery-search-exact-stat-box">
      <div className="discovery-search-exact-stat-head" aria-hidden>
        <span className="discovery-search-exact-stat-platform-logo" />
        <span className="discovery-search-exact-stat-col-label">Followers</span>
        <span className="discovery-search-exact-stat-col-label">Engagement</span>
        <span className="discovery-search-exact-stat-col-label">Avg views</span>
      </div>
      <div className="discovery-search-exact-stat-platforms">
        {rows.map((row) => {
          const showHint = platformStatRowShowsHint(row);

          return (
            <div key={row.key} className="discovery-search-exact-stat-platform">
              <div className="discovery-search-exact-stat-platform-logo">
                {row.platform ? (
                  <PlatformIcon
                    platform={row.platform}
                    size="xs"
                    variant="logo"
                    className="!size-4"
                  />
                ) : null}
              </div>
              {showHint ? (
                <span
                  className="discovery-search-exact-stat-hint"
                  title={row.metricsHint ?? undefined}
                >
                  {row.metricsHint}
                </span>
              ) : (
                <>
                  <b className="discovery-search-exact-stat-value mono">
                    {formatCreatorCount(row.followers)}
                  </b>
                  <b className="discovery-search-exact-stat-value mono">
                    {formatEngagementRate(row.engagement)}
                  </b>
                  <b className="discovery-search-exact-stat-value mono">
                    {formatCreatorCount(row.avgViews)}
                  </b>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
