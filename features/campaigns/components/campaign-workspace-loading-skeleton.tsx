import { PageBackButton } from "@/components/navigation/page-back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignWorkspaceScrollShell } from "@/features/campaigns/components/campaign-workspace-scroll-shell";

export function CampaignWorkspaceLoadingSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CampaignWorkspaceScrollShell
        chrome={
          <>
            <div className="space-y-1 pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <PageBackButton fallbackHref="/campaigns" label="Back to campaigns" />
                  <Skeleton className="h-7 w-48" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-7 w-20" />
                </div>
              </div>
              <Skeleton className="ml-10 h-4 w-64" />
            </div>

            <div className="space-y-3 pb-8">
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 min-w-[9rem] shrink-0 rounded-2xl" />
                ))}
              </div>
            </div>
          </>
        }
        tabs={
          <div className="flex gap-1 border-b border-border/60 pb-px">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-24 rounded-t-lg" />
            ))}
          </div>
        }
      >
        <div className="mt-4 space-y-4 p-4 md:p-5">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-56 w-full" />
        </div>
      </CampaignWorkspaceScrollShell>
    </div>
  );
}
