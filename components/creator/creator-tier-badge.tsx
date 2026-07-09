import { Badge } from "@/components/ui/badge";
import {
  CREATOR_TIER_BADGE_CLASS,
  type CreatorTierLabel,
} from "@/lib/creators/creator-tier";
import { cn } from "@/lib/utils";

type CreatorTierBadgeProps = {
  tier: CreatorTierLabel;
  className?: string;
};

export function CreatorTierBadge({ tier, className }: CreatorTierBadgeProps) {
  if (tier === "Unknown") return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 whitespace-nowrap px-2 text-[9px] font-semibold",
        CREATOR_TIER_BADGE_CLASS[tier],
        className
      )}
    >
      {tier}
    </Badge>
  );
}
