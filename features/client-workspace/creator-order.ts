import { compareClientListCreators } from "@/lib/creators/client-list-order";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import type { ClientCreatorCard } from "./types";

export function orderWorkspaceCreators(creators: ClientCreatorCard[]): ClientCreatorCard[] {
  return creators.map(creator => {
    const counts = (creator.platformAccounts ?? []).map(account => account.followers)
      .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
    const primary = Number.isFinite(creator.followers) ? creator.followers ?? 0 : 0;
    return { creator, tier: counts.length
      ? resolveCreatorTierLabel({ followers: Math.max(...counts) })
      : resolveCreatorTierLabel({ role: creator.tier }),
    followers: Math.max(0, primary, ...counts) };
  }).sort(compareClientListCreators).map(({ creator }) => creator);
}
