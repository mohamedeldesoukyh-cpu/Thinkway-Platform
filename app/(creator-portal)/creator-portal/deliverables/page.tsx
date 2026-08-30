import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorDocumentationUnitList } from "@/features/creator-workspace/components/creator-documentation-unit-list";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import { upcomingUnitsFromViews } from "@/lib/creator-insights/presentation";
import { loadOwnCreatorInsightPack } from "@/lib/creator-insights/service";

export default async function CreatorPortalDeliverablesPage() {
  const units = await loadCreatorUnitViews();
  const insightPack = await loadOwnCreatorInsightPack(upcomingUnitsFromViews(units));

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Deliverables</h2>
          <p className="text-sm text-muted-foreground">
            Each card is one piece of work. Upload here and Thinkway sees the same file.
          </p>
        </div>
        <CreatorDocumentationUnitList units={units} insightPack={insightPack} />
      </div>
    </PlatformErrorBoundary>
  );
}
