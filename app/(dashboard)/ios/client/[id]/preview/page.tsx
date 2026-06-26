import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { ClientIoPreviewLayoutToggle } from "@/features/io/components/client-io-preview-layout-toggle";
import { resolveClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";
import { renderLiveClientIoHtml } from "@/lib/io/render-live-client-io-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
};

export default async function ClientIoPreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const layout = resolveClientIoDocumentLayout(query.layout);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clientIo } = await supabase
    .from("client_ios")
    .select("id, document_number, campaign_header_id")
    .eq("id", id)
    .maybeSingle();

  if (!clientIo) {
    notFound();
  }

  const typed = clientIo as {
    id: string;
    document_number: string | null;
    campaign_header_id: string;
  };

  let html: string;
  let errorMessage: string | null = null;

  try {
    html = await renderLiveClientIoHtml(supabase, id, layout, user?.id);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to render Client IO preview.";
    html = "";
  }

  return (
    <DashboardShell
      title="Client IO Preview"
      description={`${typed.document_number ?? id} — client-facing insertion order`}
      hidePageHeader
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <PageBackButton
            fallbackHref={`/ios/client?io=${id}`}
            label="Back to Client IOs"
            variant="text"
          />
          <PageBackButton
            fallbackHref={`/campaigns/${typed.campaign_header_id}`}
            label="Campaign"
            variant="text"
          />
          <Suspense fallback={null}>
            <ClientIoPreviewLayoutToggle clientIoId={id} activeLayout={layout} />
          </Suspense>
        </div>
        {!errorMessage ? (
          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
              href={`/api/client-ios/${id}/document?format=html&layout=${layout}&download=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download HTML
            </a>
            <a
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
              href={`/api/client-ios/${id}/document?format=pdf&layout=${layout}&download=1`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download PDF
            </a>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <iframe
          title={`Client IO ${typed.document_number ?? id}`}
          srcDoc={html}
          className="min-h-[1200px] w-full rounded-xl border border-border bg-card"
        />
      )}
    </DashboardShell>
  );
}
