import Link from "next/link";
import { ArrowRightLeftIcon } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
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
    <DashboardShell
      title="Reassignment center"
      description="Audit trail and batch history for enterprise entity and campaign movements."
      actions={
        <Button size="sm" asChild>
          <Link href="/operations/move">
            <ArrowRightLeftIcon data-icon="inline-start" />
            Move between accounts
          </Link>
        </Button>
      }
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : batches ? (
        <ReassignmentCenter batches={batches} />
      ) : null}
    </DashboardShell>
  );
}
