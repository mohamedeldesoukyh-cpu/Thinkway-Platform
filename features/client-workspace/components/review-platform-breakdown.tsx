import {
  formatOptionalCompactCount,
  formatOptionalEngagementPct,
  formatPlatformLabel,
  listPlatformChipMetrics,
} from "../format";
import type { ClientPlatformBreakdownRow } from "../platform-breakdown";
import { clientPlatformTier, profileUrlForPlatform } from "../platform-breakdown";
import { ReviewPlatformMark } from "./review-platform-mark";

function visibleRows(rows: ClientPlatformBreakdownRow[]) {
  return rows.filter((row) => row.platform && row.platform !== "_other");
}

export function ReviewPlatformBreakdown({
  rows,
  variant,
}: {
  rows: ClientPlatformBreakdownRow[];
  variant: "list" | "detail";
}) {
  const platforms = visibleRows(rows);
  if (platforms.length === 0) return null;

  if (variant === "list") {
    return (
      <div className="plat-ers">
        {platforms.map((row) => {
          const { followers, engagementRate } = listPlatformChipMetrics(row);
          const label = formatPlatformLabel(row.platform) ?? row.platform;
          const tier = clientPlatformTier(row.followers);
          return (
            <span
              className="plat-er"
              key={row.platform}
              title={
                [label, tier, followers ? `${followers} followers` : null, engagementRate]
                  .filter(Boolean)
                  .join(" · ")
              }
            >
              <ReviewPlatformMark platform={row.platform} />
              {followers || engagementRate ? (
                <span className="plat-er-metrics">
                  {followers ? (
                    <span className="plat-er-heading">
                      <b>{followers}</b>
                      {tier ? <span className="platform-tier" aria-label={`${label} tier: ${tier}`}>{tier}</span> : null}
                    </span>
                  ) : null}
                  {engagementRate ? <span className="er">{engagementRate}</span> : null}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="dt-quick plat-quick">
      {platforms.map((row) => {
        const url = profileUrlForPlatform(row.platform, row.handle, row.profileUrl);
        const mark = <ReviewPlatformMark platform={row.platform} />;
        const followers = formatOptionalCompactCount(row.followers);
        const er = formatOptionalEngagementPct(row.engagementRate);
        const tier = clientPlatformTier(row.followers);
        return (
          <div className="q" key={row.platform}>
            <p className="l">
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {mark}
                </a>
              ) : (
                mark
              )}
              {formatPlatformLabel(row.platform)}
            </p>
            {followers ? <p className="v">{followers}</p> : null}
            {tier ? <span className="platform-tier" aria-label={`${formatPlatformLabel(row.platform) ?? row.platform} tier: ${tier}`}>{tier}</span> : null}
            {er ? <p className="er">{er}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
