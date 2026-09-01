import { CreatorDocumentationUnitCard } from "@/features/creator-workspace/components/creator-documentation-unit-card";
import { CreatorEmpty } from "@/features/creator-workspace/components/creator-workspace-ui";
import { unitNeedsCreatorAction } from "@/features/creator-workspace/chrome";
import type { CreatorUnitView } from "@/features/creator-workspace/documentation-load";
import { analysisForUnit, compactInsightForUnit } from "@/lib/creator-insights/presentation";
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
      <CreatorEmpty
        title="Nothing to deliver yet"
        description="Deliverables appear here once Thinkway assigns you to a campaign."
      />
    );
  }

  const groups = new Map<string, CreatorUnitView[]>();
  for (const unit of units) {
    const list = groups.get(unit.campaignName) ?? [];
    list.push(unit);
    groups.set(unit.campaignName, list);
  }

  return (
    <>
      {[...groups.entries()].map(([campaignName, group]) => {
        const sorted = [...group].sort(
          (a, b) => Number(unitNeedsCreatorAction(b)) - Number(unitNeedsCreatorAction(a))
        );
        const done = group.filter((unit) => unit.status === "published").length;
        return (
          <section key={campaignName} className="grp">
            <div className="grp__h">
              <span className="grp__t">{campaignName}</span>
              <span className="grp__m">
                {done} of {group.length} done
              </span>
            </div>
            {sorted.map((unit) => (
              <CreatorDocumentationUnitCard
                key={unit.unitKey}
                unit={unit}
                showCampaignLink={showCampaignLink}
                hideScript={hideScript}
                compactInsight={insightPack ? compactInsightForUnit(insightPack, unit) : null}
                analysis={insightPack ? analysisForUnit(insightPack, unit) : null}
              />
            ))}
          </section>
        );
      })}
    </>
  );
}
