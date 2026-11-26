import { PreviewDownloadMenu } from "@/features/discovery/document-preview/preview-download-menu";
import { DocumentPreviewClient } from "@/features/discovery/document-preview/document-preview-client";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

import { ClientIoPreviewLayoutToggle } from "@/features/io/components/client-io-preview-layout-toggle";
import { resolveClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";
import { renderLiveClientIoHtml } from "@/lib/io/render-live-client-io-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string; returnTo?: string; saved?: string }>;
};

export default async function ClientIoPreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const saved = query.saved === "1";
  const layout = resolveClientIoDocumentLayout(query.layout);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clientIo } = await supabase
    .from("client_ios")
    .select("id, document_number, campaign_header_id, approved_at, status, revision_number")
    .eq("id", id)
    .maybeSingle();

  if (!clientIo) {
    notFound();
  }

  const typed = clientIo as {
    id: string;
    document_number: string | null;
    campaign_header_id: string;
    approved_at: string | null;
    status: string;
    revision_number: number;
  };

  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") && !query.returnTo.includes("\\")
    ? query.returnTo : `/campaigns/${typed.campaign_header_id}?tab=client-io`;

  let html: string;
  let errorMessage: string | null = null;

  try {
    html = saved ? "" : await renderLiveClientIoHtml(supabase, id, layout, user?.id);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to render Client IO preview.";
    html = "";
  }

  return (
    <DashboardShell
      containedMain hideDesktopHeader
      title="Client IO Preview"
      description={`${typed.document_number ?? id} — client-facing insertion order`}
      hidePageHeader
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <DocumentPreviewClient
          closeHref={returnTo}
          contained
          toolbarLeft={saved ? <span className="text-sm">Saved IO · Version {typed.revision_number + 1}</span> : <Suspense fallback={null}><ClientIoPreviewLayoutToggle clientIoId={id} activeLayout={layout} /></Suspense>}
          toolbarRight={<PreviewDownloadMenu formats={[
            {format: "pdf", label: "PDF", href: `/api/client-ios/${id}/document?format=pdf&layout=${layout}&download=1${saved ? "&saved=1" : ""}`},
            {format: "html", label: "HTML", href: `/api/client-ios/${id}/document?format=html&layout=${layout}&download=1${saved ? "&saved=1" : ""}`},
          ]} />}
          title={`Client IO ${typed.document_number ?? id}`}
          html={saved ? undefined : html}
          src={saved ? `/api/client-ios/${id}/document?format=html&saved=1` : undefined}
          sandbox="allow-same-origin allow-downloads"
        />
      )}
    </DashboardShell>
  );
}
