import {
  formatCompactCount,
  formatEngagementPct,
  formatPlatformLabel,
} from "../format";
import type { ClientPlatformBreakdownRow } from "../platform-breakdown";
import { profileUrlForPlatform } from "../platform-breakdown";
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
        {platforms.map((row) => (
          <span className="plat-er" key={row.platform}>
            <ReviewPlatformMark platform={row.platform} />
            <b>{formatEngagementPct(row.engagementRate)}</b>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="dt-quick plat-quick">
      {platforms.map((row) => {
        const url = profileUrlForPlatform(row.platform, row.handle, row.profileUrl);
        const mark = <ReviewPlatformMark platform={row.platform} />;
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
            <p className="v">{formatCompactCount(row.followers)}</p>
            <p className="er">{formatEngagementPct(row.engagementRate)}</p>
          </div>
        );
      })}
    </div>
  );
}
