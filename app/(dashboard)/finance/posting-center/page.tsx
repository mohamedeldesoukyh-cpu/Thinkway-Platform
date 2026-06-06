import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PostingCenterWorkspace } from "@/features/finance/posting-center/components/posting-center-workspace";
import { getPostingBatches, getPostingPreview } from "@/features/finance/posting-center/queries";

export default async function PostingCenterPage() {
  const period_from = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const period_to = new Date().toISOString().slice(0, 10);

  const [preview, batches] = await Promise.all([
    getPostingPreview({
      transaction_type: "client_invoice",
      period_from,
      period_to,
    }),
    getPostingBatches(),
  ]);

  return (
    <DashboardShell
      title="Posting center"
      description="Operational finance subledger bridge — batch-controlled posting to ERP."
    >
      <PlatformErrorBoundary surface="finance">
        <PostingCenterWorkspace
          initialPreview={preview}
          batches={batches}
          defaultTransactionType="client_invoice"
          defaultPeriodFrom={period_from}
          defaultPeriodTo={period_to}
        />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
