import { FinanceSuiteShell } from "@/components/finance/suite";
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
    <FinanceSuiteShell
      title="Posting center"
      description="Operational subledger to batch-controlled ERP bridge"
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
    </FinanceSuiteShell>
  );
}
