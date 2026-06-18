import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AgingWorkspace } from "@/features/finance/aging/components/aging-workspace";
import {
  getAgingWorkspace,
  parseAgingReportSearchParams,
} from "@/features/finance/aging/queries";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinanceAgingPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseAgingReportSearchParams(params);

  let data;
  let errorMessage: string | null = null;

  try {
    data = await getAgingWorkspace(query);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load aging reports.";
  }

  return (
    <DashboardShell
      title="Aging reports"
      description="Client receivables aging by invoice date and overdue aging by due date. Outstanding balances only."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : data ? (
        <AgingWorkspace data={data} />
      ) : null}
    </DashboardShell>
  );
}
