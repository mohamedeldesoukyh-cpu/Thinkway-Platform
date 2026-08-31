import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorDocumentationUnitList } from "@/features/creator-workspace/components/creator-documentation-unit-list";
import { CreatorPageHeader } from "@/features/creator-workspace/components/creator-workspace-ui";
import { countUnitsNeedingCreator } from "@/features/creator-workspace/home-next-actions";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import { upcomingUnitsFromViews } from "@/lib/creator-insights/presentation";
import { loadOwnCreatorInsightPack } from "@/lib/creator-insights/service";

export default async function CreatorPortalDeliverablesPage() {
  const units = await loadCreatorUnitViews();
  const insightPack = await loadOwnCreatorInsightPack(upcomingUnitsFromViews(units));
  const needs = countUnitsNeedingCreator(units);

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorPageHeader
        title="Deliverables"
        description={
          needs
            ? `${needs} need${needs === 1 ? "s" : ""} something from you. Upload, read feedback and add your link — all here.`
            : "Everything you owe, with feedback and versions in place."
        }
      />
      <CreatorDocumentationUnitList units={units} insightPack={insightPack} />
    </PlatformErrorBoundary>
  );
}
