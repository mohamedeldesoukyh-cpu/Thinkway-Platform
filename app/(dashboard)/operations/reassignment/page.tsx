import Link from "next/link";

import { FinanceSuiteRoot } from "@/components/finance/suite";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { ReassignmentCenter } from "@/features/operations/components/reassignment-center";
import { getMovementBatches } from "@/features/operations/queries";

export default async function ReassignmentCenterPage() {
  let batches;
  let errorMessage: string | null = null;

  try {
    batches = await getMovementBatches();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load reassignment center.";
  }

  return (
    <FinanceSuiteRoot>
      <FinanceSuiteShell
        title="Reassignment center"
        description="Audit trail for campaign movements"
        actions={
          <Link href="/operations/move" className="tw-b">
            Move between accounts
          </Link>
        }
      >
        {errorMessage ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : batches ? (
          <ReassignmentCenter batches={batches} />
        ) : null}
      </FinanceSuiteShell>
    </FinanceSuiteRoot>
  );
}
