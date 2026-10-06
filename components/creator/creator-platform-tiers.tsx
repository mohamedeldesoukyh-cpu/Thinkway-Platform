import { CreatorTierBadge } from "./creator-tier-badge";
import { resolvePlatformTier, type CreatorPlatformTierAccount } from "@/lib/creators/creator-tier";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { PlatformIcon, PLATFORM_ICON_STYLES } from "@/lib/performance/platform-icon";

export function CreatorPlatformTiers({ accounts }: { accounts: CreatorPlatformTierAccount[] }) {
  if (accounts.length === 0) return <span className="tw-miss">—</span>;
  return (
    <span className="flex flex-col items-start gap-1">
      {sortPlatformsStable(accounts).map((account, index) => {
        const tier = resolvePlatformTier(account.followers);
        const label = PLATFORM_ICON_STYLES[account.platform]?.title ?? account.platform;
        return (
          <span key={`${account.platform}:${account.handle ?? index}`} className="inline-flex items-center gap-1"
            title={`${label}${account.handle ? ` @${account.handle.replace(/^@/, "")}` : ""}: ${tier ?? "Tier unavailable"}`}
            aria-label={`${label} tier: ${tier ?? "unavailable"}`}>
            <PlatformIcon platform={account.platform} variant="logo" size="xs" className="size-3.5 shrink-0" />
            {tier ? <CreatorTierBadge tier={tier} className="px-1.5" /> : <span className="tw-miss">—</span>}
          </span>
        );
      })}
    </span>
  );
}
