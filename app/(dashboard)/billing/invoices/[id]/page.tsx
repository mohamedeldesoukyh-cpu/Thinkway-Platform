import { notFound } from "next/navigation";

import { FinanceSuiteRoot } from "@/components/finance/suite";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { InvoiceWorkspaceView } from "@/features/billing/components/invoice-workspace";
import { getInvoiceWorkspace } from "@/features/billing/queries";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";

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

  const displayNumber = invoice
    ? formatDocumentNumberForDisplay(invoice.document_number)
    : null;

  return (
    <FinanceSuiteRoot>
      <FinanceSuiteShell
        title={displayNumber ? `Invoice ${displayNumber}` : "Invoice"}
        description="Invoice detail — lines, collections, approvals and audit history"
      >
        {errorMessage ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : invoice ? (
          <PlatformErrorBoundary surface="invoices">
            <InvoiceWorkspaceView invoice={invoice} />
          </PlatformErrorBoundary>
        ) : null}
      </FinanceSuiteShell>
    </FinanceSuiteRoot>
  );
}
