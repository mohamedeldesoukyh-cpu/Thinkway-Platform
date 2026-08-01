import { PageBackButton } from "@/components/navigation/page-back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignWorkspaceScrollShell } from "@/features/campaigns/components/campaign-workspace-scroll-shell";

export function CampaignWorkspaceLoadingSkeleton() {
  return (
    <div className="thinkway-campaign-workspace flex min-h-0 flex-1 flex-col overflow-hidden">
      <CampaignWorkspaceScrollShell
        chrome={
          <>
            <div className="thinkway-campaign-header-inner">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <PageBackButton
                  fallbackHref="/campaigns"
                  label="Back to campaigns"
                  className="thinkway-campaign-back-btn size-[26px] rounded-[var(--camp-radius)] p-0"
                />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="mb-2.5 h-3 w-64" />
              <div className="thinkway-campaign-metrics-band">
                <div className="thinkway-campaign-metrics-section space-y-2">
                  <Skeleton className="h-2 w-16" />
                  <div className="flex gap-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-20" />
                    ))}
                  </div>
                </div>
                <div className="thinkway-campaign-metrics-section space-y-2">
                  <Skeleton className="h-2 w-16" />
                  <div className="flex gap-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-20" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <Skeleton className="h-8 w-full rounded-none" />
          </>
        }
        tabs={
          <div className="enterprise-tabs px-3 pt-1.5" data-variant="underline">
            <div className="enterprise-tabs-list" data-overflow="scroll">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="my-2.5 h-4 w-24 shrink-0" />
              ))}
            </div>
          </div>
        }
      >
        <div className="thinkway-campaign-content space-y-3.5">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-3.5 md:grid-cols-3">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </CampaignWorkspaceScrollShell>
    </div>
  );
}
