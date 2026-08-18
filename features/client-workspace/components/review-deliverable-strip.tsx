import { looksLikePlatformList, summarizeCreatorDeliverables } from "../deliverables";
import type { ClientDeliverableItem } from "../types";
import { ReviewPlatformMark } from "./review-platform-mark";

export function ReviewDeliverableStrip({
  items,
  fallback,
}: {
  items?: ClientDeliverableItem[];
  fallback?: string;
}) {
  const summary = summarizeCreatorDeliverables(items);
  if (summary.lines.length === 0 && summary.platforms.length === 0) {
    const text = fallback?.trim();
    if (!text || looksLikePlatformList(text)) return null;
    return <div className="dels fallback">{text}</div>;
  }

  return (
    <div className="dels">
      {summary.platforms.map((platform) => (
        <ReviewPlatformMark key={platform} platform={platform} />
      ))}
      {summary.lines.map((line) => (
        <span className="del-chip" key={line.key}>
          {line.label}
          <b>×{line.quantity}</b>
        </span>
      ))}
    </div>
  );
}
