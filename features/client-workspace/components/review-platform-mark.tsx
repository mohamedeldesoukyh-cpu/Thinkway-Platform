import { PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

export function ReviewPlatformMark({
  platform,
  title,
}: {
  platform: string;
  title?: string;
}) {
  const key = canonicalPlatformKey(platform);
  const badge = PLATFORM_ICON_STYLES[key];
  const label = title ?? badge?.title ?? platform;

  if (badge?.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="plat-mark" src={badge.imageUrl} alt="" title={label} />
    );
  }

  return (
    <span className="plat-mark fallback" title={label} aria-label={label}>
      {(badge?.label ?? key.slice(0, 2).toUpperCase() || "?").slice(0, 2)}
    </span>
  );
}

export function ReviewPlatformStack({ platforms }: { platforms: string[] }) {
  if (platforms.length === 0) return null;
  return (
    <span className="plat-stack">
      {platforms.map((platform) => (
        <ReviewPlatformMark key={platform} platform={platform} />
      ))}
    </span>
  );
}
