import { CreatorDocumentationUnitCard } from "@/features/creator-workspace/components/creator-documentation-unit-card";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import { compactInsightForUnit } from "@/lib/creator-insights/presentation";
import type { CreatorInsightPack } from "@/lib/creator-insights/types";

export function CreatorDocumentationUnitList({
  units,
  showCampaignLink = true,
  insightPack = null,
  hideScript = false,
}: {
  units: CreatorUnitView[];
  showCampaignLink?: boolean;
  insightPack?: CreatorInsightPack | null;
  hideScript?: boolean;
}) {
  if (units.length === 0) {
    return (
      <p className="rounded-2xl border border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No deliverables assigned yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {units.map((unit) => (
        <CreatorDocumentationUnitCard
          key={unit.unitKey}
          unit={unit}
          showCampaignLink={showCampaignLink}
          hideScript={hideScript}
          compactInsight={insightPack ? compactInsightForUnit(insightPack, unit) : null}
        />
      ))}
    </div>
  );
}
