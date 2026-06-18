import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientClassificationReviewTable } from "@/features/clients/components/client-classification-review-table";
import { getClientClassificationReviewQueue } from "@/features/clients/classification-review-queries";

export default async function ClientClassificationReviewPage() {
  const { rows, error } = await getClientClassificationReviewQueue();

  return (
    <DashboardShell
      title="Client classification review"
      description="Review low-confidence and AI-suggested client categories before they are trusted for reporting."
    >
      <PlatformErrorBoundary surface="generic">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <p className="font-medium">Could not load review queue.</p>
            <p className="mt-1">{error}</p>
            {error.includes("needs_review") ? (
              <p className="mt-2 text-xs">
                Run database migrations:{" "}
                <code className="font-mono">npx supabase db push</code>
              </p>
            ) : null}
          </div>
        ) : (
          <ClientClassificationReviewTable rows={rows} />
        )}
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
