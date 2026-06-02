import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import { ClientIosTable } from "@/features/io/components/client-ios-table";
import { IoSearchFilters } from "@/features/io/components/io-search-filters";
import { getClientIos } from "@/features/io/queries";

type Props = {
  searchParams: Promise<{ q?: string; status?: string; io?: string }>;
};

export default async function ClientIosPage({ searchParams }: Props) {
  const params = await searchParams;
  const rows = await getClientIos({ status: params.status });
  const selected = params.io ? rows.find((row) => row.id === params.io) ?? null : rows[0] ?? null;

  return (
    <DashboardShell
      title="Client IOs"
      description="Campaign-level IO tracking for clients. Draft, send, approve — without blocking campaign execution."
    >
      <PlatformErrorBoundary surface="ios">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Client IO register</CardTitle>
              <IoSearchFilters
                statuses={[
                  { value: "all", label: "All statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "sent", label: "Sent" },
                  { value: "approved", label: "Approved" },
                ]}
              />
            </CardHeader>
            <CardContent>
              <ClientIosTable rows={rows} selectedId={selected?.id ?? null} />
            </CardContent>
          </Card>

          {selected ? <ClientIoForm key={selected.id} row={selected} /> : null}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}

