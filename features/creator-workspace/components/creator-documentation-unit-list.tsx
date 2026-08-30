import { CreatorDocumentationUnitCard } from "@/features/creator-workspace/components/creator-documentation-unit-card";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";

export function CreatorDocumentationUnitList({
  units,
  showCampaignLink = true,
}: {
  units: CreatorUnitView[];
  showCampaignLink?: boolean;
}) {
  if (units.length === 0) {
    return (
      <p className="rounded-2xl border border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing to deliver yet.
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
        />
      ))}
    </div>
  );
}
