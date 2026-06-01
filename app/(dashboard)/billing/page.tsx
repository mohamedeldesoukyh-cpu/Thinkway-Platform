import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BillingWorkspaceView } from "@/features/billing/components/billing-workspace";
import { getBillingDashboard } from "@/features/billing/queries";

export default async function BillingPage() {
  let dashboard;
  let errorMessage: string | null = null;

  try {
    dashboard = await getBillingDashboard();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load billing workspace.";
  }

  return (
    <DashboardShell
      title="Billing & finance"
      description="Enterprise finance operations — invoicing, collections, PO tracking, vendor payments, and approvals."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : dashboard ? (
        <BillingWorkspaceView dashboard={dashboard} />
      ) : null}
    </DashboardShell>
  );
}
