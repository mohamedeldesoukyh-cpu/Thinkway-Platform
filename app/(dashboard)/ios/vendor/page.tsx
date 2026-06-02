import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IoSearchFilters } from "@/features/io/components/io-search-filters";
import { VendorIoForm } from "@/features/io/components/vendor-io-form";
import { VendorIosTable } from "@/features/io/components/vendor-ios-table";
import { getVendorIos } from "@/features/io/queries";

type Props = {
  searchParams: Promise<{ q?: string; status?: string; io?: string }>;
};

export default async function VendorIosPage({ searchParams }: Props) {
  const params = await searchParams;
  const rows = await getVendorIos({ status: params.status });
  const selected = params.io ? rows.find((row) => row.id === params.io) ?? null : rows[0] ?? null;

  return (
    <DashboardShell
      title="Vendor IOs"
      description="Assignment-level IO tracking for vendors/influencers. Lightweight operational workflow only."
    >
      <PlatformErrorBoundary surface="ios">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Vendor IO register</CardTitle>
              <IoSearchFilters
                statuses={[
                  { value: "all", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "sent", label: "Sent" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                ]}
              />
            </CardHeader>
            <CardContent>
              <VendorIosTable rows={rows} />
            </CardContent>
          </Card>

          {selected ? <VendorIoForm row={selected} /> : null}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}

