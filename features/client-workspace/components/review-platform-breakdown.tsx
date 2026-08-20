import {
  formatOptionalCompactCount,
  formatOptionalEngagementPct,
  formatPlatformLabel,
  listPlatformChipValue,
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
        {platforms.map((row) => {
          const value = listPlatformChipValue(row);
          const followers = formatOptionalCompactCount(row.followers);
          const label = formatPlatformLabel(row.platform) ?? row.platform;
          return (
            <span
              className="plat-er"
              key={row.platform}
              title={followers ? `${label} · ${followers} followers` : label}
            >
              <ReviewPlatformMark platform={row.platform} />
              {value ? <b>{value}</b> : null}
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
            {er ? <p className="er">{er}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
