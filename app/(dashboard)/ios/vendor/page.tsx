import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { IoSearchFilters } from "@/features/io/components/io-search-filters";
import { VendorIosWorkspace } from "@/features/io/components/vendor-ios-workspace";
import { getVendorIos } from "@/features/io/queries";

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    io?: string;
    campaign?: string;
  }>;
};

export default async function VendorIosPage({ searchParams }: Props) {
  const params = await searchParams;
  const rows = await getVendorIos({ status: params.status });
  const selected = params.io ? rows.find((row) => row.id === params.io) ?? null : rows[0] ?? null;

  const campaignId = params.campaign ?? selected?.campaign_header_id ?? null;

  return (
    <FinanceSuiteShell
      title="Vendor IO register"
      description="Insertion orders — one per creator assignment"
      backFallbackHref={campaignId ? `/campaigns/${campaignId}` : undefined}
      backLabel="Back to campaign"
    >
      <PlatformErrorBoundary surface="ios">
        <VendorIosWorkspace
          rows={rows}
          initialSelectedId={selected?.id ?? null}
          leading={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Vendor IO register
              </h2>
              <IoSearchFilters
                statuses={[
                  { value: "all", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "generated", label: "Generated" },
                  { value: "sent", label: "Sent" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
            </div>
          }
        />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}

