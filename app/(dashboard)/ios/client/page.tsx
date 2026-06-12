import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientIosWorkspace } from "@/features/io/components/client-ios-workspace";
import { IoSearchFilters } from "@/features/io/components/io-search-filters";
import { getClientIos } from "@/features/io/queries";

type Props = {
  searchParams: Promise<{ q?: string; status?: string; io?: string }>;
};

export default async function ClientIosPage({ searchParams }: Props) {
  const params = await searchParams;
  const rows = await getClientIos({ status: params.status });
  const selected = params.io ? rows.find((row) => row.id === params.io) ?? null : rows[0] ?? null;

  const campaignId = selected?.campaign_header_id ?? null;
  const backFallbackHref = campaignId
    ? `/campaigns/${campaignId}`
    : "/ios/client";

  return (
    <DashboardShell
      title="Client IOs"
      description="Campaign-level IO tracking for clients. Draft, send, approve — without blocking campaign execution."
      backFallbackHref={backFallbackHref}
      backLabel={campaignId ? "Back to campaign" : "Back to client IOs"}
    >
      <PlatformErrorBoundary surface="ios">
        <ClientIosWorkspace
          rows={rows}
          initialSelectedId={selected?.id ?? null}
          leading={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Client IO register
              </h2>
              <IoSearchFilters
                statuses={[
                  { value: "all", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "generated", label: "Generated" },
                  { value: "sent", label: "Sent" },
                  { value: "approved", label: "Approved" },
                ]}
              />
            </div>
          }
        />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}

