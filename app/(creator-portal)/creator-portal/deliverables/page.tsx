import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorDocumentationUnitList } from "@/features/creator-workspace/components/creator-documentation-unit-list";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";

export default async function CreatorPortalDeliverablesPage() {
  const units = await loadCreatorUnitViews();

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Deliverables</h2>
          <p className="text-sm text-muted-foreground">
            Each card is one piece of work. Upload here and Thinkway sees the same file.
          </p>
        </div>
        <CreatorDocumentationUnitList units={units} />
      </div>
    </PlatformErrorBoundary>
  );
}
