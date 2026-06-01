import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InvoiceWorkspaceView } from "@/features/billing/components/invoice-workspace";
import { getInvoiceWorkspace } from "@/features/billing/queries";

type InvoicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoicePage({ params }: InvoicePageProps) {
  const { id } = await params;

  let invoice;
  let errorMessage: string | null = null;

  try {
    invoice = await getInvoiceWorkspace(id);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load invoice.";
  }

  if (!invoice && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Invoice"
      description="Invoice detail, collections, approvals, and audit history."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : invoice ? (
        <InvoiceWorkspaceView invoice={invoice} />
      ) : null}
    </DashboardShell>
  );
}
