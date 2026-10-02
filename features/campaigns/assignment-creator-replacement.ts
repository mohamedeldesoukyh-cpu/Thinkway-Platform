import type { InfluencerAssignmentProfile } from "./types";
import type { PlatformSelectionState } from "./components/platform-account-selector";

/** Preserve the plan while rebinding it exclusively to the replacement's accounts. */
export function replacementPlatformSelections(profile: InfluencerAssignmentProfile, existing: PlatformSelectionState[], requiredPlatforms: string[] = []): PlatformSelectionState[] {
  const selected = existing.filter(p => p.selected);
  const required = new Set([...selected.map(p => p.platform), ...requiredPlatforms]);
  for (const platform of required) {
    const accounts = profile.platforms.filter(p => p.platform === platform);
    if (accounts.length !== 1) throw new Error(accounts.length === 0
      ? `The replacement needs a ${platform} account to keep the current deliverables. Add that account first.`
      : `The replacement has multiple ${platform} accounts. Choose a creator with one matching account before replacing.`);
    if (selected.filter(p => p.platform === platform).length > 1) throw new Error(`Multiple ${platform} accounts are assigned. Update the platform plan before replacing this creator.`);
  }
  return profile.platforms.map(account => {
    const previous = selected.find(p => p.platform === account.platform);
    return { account_id: account.id, platform: account.platform, handle: account.handle, profile_url: account.profile_url,
      follower_count: account.follower_count, engagement_rate: account.engagement_rate, audience_country: account.audience_country,
      deliverables: previous?.deliverables ?? [], selected: Boolean(previous) };
  });
}
