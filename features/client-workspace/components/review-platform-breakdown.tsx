import {
  formatCompactCount,
  formatEngagementPct,
  formatPlatformLabel,
  NOT_AVAILABLE,
} from "../format";
import type { ClientPlatformBreakdownRow } from "../platform-breakdown";
import { ReviewPlatformMark } from "./review-platform-mark";

function metricParts(row: ClientPlatformBreakdownRow, compact: boolean): string[] {
  if (row.platform === "_other") return [];
  const parts: string[] = [];
  if (row.handle) parts.push(row.handle);
  const followers = formatCompactCount(row.followers);
  const er = formatEngagementPct(row.engagementRate);
  if (followers !== NOT_AVAILABLE) parts.push(followers);
  if (er !== NOT_AVAILABLE) parts.push(compact ? `ER ${er}` : er);
  if (followers === NOT_AVAILABLE && er === NOT_AVAILABLE) parts.push(NOT_AVAILABLE);
  return parts;
}

function avgParts(row: ClientPlatformBreakdownRow): string[] {
  const parts: string[] = [];
  if (row.avgLikes != null) parts.push(`Avg likes ${formatCompactCount(row.avgLikes)}`);
  if (row.avgViews != null) parts.push(`Avg views ${formatCompactCount(row.avgViews)}`);
  if (row.avgComments != null) parts.push(`Avg comments ${formatCompactCount(row.avgComments)}`);
  return parts;
}

export function ReviewPlatformBreakdown({
  rows,
  variant,
}: {
  rows: ClientPlatformBreakdownRow[];
  variant: "list" | "detail";
}) {
  if (rows.length === 0) return null;
  const compact = variant === "list";

  return (
    <div className={compact ? "plat-rows compact" : "plat-rows detail"}>
      {rows.map((row) => {
        const showMark = Boolean(row.platform && row.platform !== "_other");
        return (
          <div className="plat-row" key={row.platform || "other"}>
            {showMark ? <ReviewPlatformMark platform={row.platform} /> : null}
            <div className="plat-body">
              {(!compact && showMark) || metricParts(row, compact).length > 0 ? (
              <div className="plat-meta">
                {!compact && showMark ? (
                  <span className="plat-name">{formatPlatformLabel(row.platform)}</span>
                ) : null}
                {metricParts(row, compact).length > 0 ? (
                  <span>{metricParts(row, compact).join(" · ")}</span>
                ) : null}
              </div>
              ) : null}
              {!compact ? (
                avgParts(row).length > 0 ? (
                  <div className="plat-avgs">{avgParts(row).join(" · ")}</div>
                ) : null
              ) : null}
              {row.lines.length > 0 ? (
                <div className="dels">
                  {row.lines.map((line) => (
                    <span className="del-chip" key={line.key}>
                      {line.label}
                      <b>×{line.quantity}</b>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
