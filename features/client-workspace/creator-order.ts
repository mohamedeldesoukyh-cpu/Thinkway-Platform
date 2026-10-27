import { compareRecommendations } from "@/lib/creators/shortlist-recommendations";
import { orderCreatorGroups } from "@/lib/quotations/quotation-creator-order";
import { compareClientListCreators } from "@/lib/creators/client-list-order";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import type { ClientCreatorCard } from "./types";

export function orderWorkspaceCreators(creators: ClientCreatorCard[], customOrder?: string[]): ClientCreatorCard[] {
  const automatic = creators.map(creator => {
    const counts = (creator.platformAccounts ?? []).map(account => account.followers)
      .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
    const primary = Number.isFinite(creator.followers) ? creator.followers ?? 0 : 0;
    return { creator, tier: counts.length
      ? resolveCreatorTierLabel({ followers: Math.max(...counts) })
      : resolveCreatorTierLabel({ role: creator.tier }),
    followers: Math.max(0, primary, ...counts) };
  }).sort((a, b) => {
    const manual = (a.creator.shortlistOrderIndex ?? Number.MAX_SAFE_INTEGER) - (b.creator.shortlistOrderIndex ?? Number.MAX_SAFE_INTEGER);
    return manual || compareRecommendations(a.creator, b.creator) || compareClientListCreators(a, b);
  }).map(({ creator }) => creator);
  return orderCreatorGroups(automatic, customOrder, creator => (creator.quotationOptions ?? []).flatMap(option => [option.itemId, ...(option.memberItemIds ?? [])]))
    .sort((a, b) => Number(a.creatorId.startsWith("service:")) - Number(b.creatorId.startsWith("service:")));
}
