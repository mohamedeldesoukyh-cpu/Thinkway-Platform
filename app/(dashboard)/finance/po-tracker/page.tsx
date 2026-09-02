import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PoTrackerWorkspace } from "@/features/finance/po-tracker/components/po-tracker-workspace";
import { getPoTrackerWorkspace } from "@/features/finance/po-tracker/queries";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function FinancePoTrackerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  let errorMessage: string | null = null;
  let data = null;

  try {
    data = await getPoTrackerWorkspace(params);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load PO tracker.";
  }

  return (
    <FinanceSuiteShell
      title="PO tracker"
      description="Purchase-order consumption and remaining budget by campaign"
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : data ? (
        <PoTrackerWorkspace data={data} />
      ) : null}
    </FinanceSuiteShell>
  );
}
