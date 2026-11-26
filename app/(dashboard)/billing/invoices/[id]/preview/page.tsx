import { PreviewDownloadMenu } from "@/features/discovery/document-preview/preview-download-menu";
import { DocumentPreviewClient } from "@/features/discovery/document-preview/document-preview-client";
import { documentReturnPath } from "@/lib/navigation/document-return";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { InvoicePreviewLayoutToggle } from "@/features/billing/components/invoice-preview-layout-toggle";
import { resolveInvoiceDocumentLayout } from "@/lib/billing/invoice-document-layout";
import { renderLiveInvoiceHtml } from "@/lib/billing/render-live-invoice-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvoicePreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string; returnTo?: string }>;
};

export default async function InvoicePreviewPage({
  params,
  searchParams,
}: InvoicePreviewPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const layout = resolveInvoiceDocumentLayout(query.layout);
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
    html = await renderLiveInvoiceHtml(supabase, id, layout);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to render invoice preview.";
    html = "";
  }

  return (
    <DashboardShell
      containedMain hideDesktopHeader
      title="Invoice preview"
      description={`${typed.document_number ?? id} — client-facing tax invoice`}
      hidePageHeader
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <DocumentPreviewClient
          closeHref={documentReturnPath(query.returnTo, `/billing/invoices/${id}`)}
          contained
          toolbarLeft={<Suspense fallback={null}><InvoicePreviewLayoutToggle invoiceId={id} activeLayout={layout} /></Suspense>}
          toolbarRight={<PreviewDownloadMenu formats={[
            {format: "pdf", label: "PDF", href: `/api/invoices/${id}/document?format=pdf&layout=${layout}&download=1`},
            {format: "html", label: "HTML", href: `/api/invoices/${id}/document?format=html&layout=${layout}&download=1`},
          ]} />}
          title={`Invoice ${typed.document_number ?? id}`}
          html={html}
        />
      )}
    </DashboardShell>
  );
}
