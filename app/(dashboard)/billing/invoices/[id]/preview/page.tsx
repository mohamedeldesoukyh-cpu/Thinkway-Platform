import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { renderLiveInvoiceHtml } from "@/lib/billing/render-live-invoice-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvoicePreviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoicePreviewPage({ params }: InvoicePreviewPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, document_number")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) {
    notFound();
  }

  const typed = invoice as { id: string; document_number: string | null };

  let html: string;
  let errorMessage: string | null = null;

  try {
    html = await renderLiveInvoiceHtml(supabase, id);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to render invoice preview.";
    html = "";
  }

  return (
    <DashboardShell
      title="Invoice preview"
      description={`${typed.document_number ?? id} — client-facing tax invoice`}
      hidePageHeader
    >
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <PageBackButton
          fallbackHref={`/billing/invoices/${id}`}
          label="Back to invoice workspace"
          variant="text"
        />
        {!errorMessage ? (
          <>
            <a
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
              href={`/api/invoices/${id}/document?format=html&download=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download HTML
            </a>
            <a
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
              href={`/api/invoices/${id}/document?format=pdf&download=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download PDF
            </a>
          </>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <iframe
          title={`Invoice ${typed.document_number ?? id}`}
          srcDoc={html}
          className="min-h-[1200px] w-full rounded-xl border border-border bg-white"
        />
      )}
    </DashboardShell>
  );
}
