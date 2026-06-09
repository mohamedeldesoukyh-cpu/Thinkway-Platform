import { notFound } from "next/navigation";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { InvoiceHtmlPreview } from "@/features/billing/components/invoice-html-preview";
import { getInvoiceWorkspace } from "@/features/billing/queries";

type InvoicePreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoicePreviewPage({ params }: InvoicePreviewPageProps) {
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
      title="Invoice preview"
      description="Client-facing HTML preview for finance review (Phase 2a)."
      hidePageHeader
    >
      <div className="mb-4 print:hidden">
        <PageBackButton
          fallbackHref={`/billing/invoices/${id}`}
          label="Back to invoice workspace"
          variant="text"
        />
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : invoice ? (
        <PlatformErrorBoundary surface="invoices">
          <InvoiceHtmlPreview
            invoice={invoice}
            backHref={`/billing/invoices/${id}`}
          />
        </PlatformErrorBoundary>
      ) : null}
    </DashboardShell>
  );
}
