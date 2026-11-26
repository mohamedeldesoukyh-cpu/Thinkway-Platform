import { DocumentPreviewClient } from "@/features/discovery/document-preview/document-preview-client";
import { notFound } from "next/navigation";

import { documentReturnPath } from "@/lib/navigation/document-return";
import { PreviewDownloadMenu } from "@/features/discovery/document-preview/preview-download-menu";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { renderLiveVendorIoHtml } from "@/lib/io/render-live-vendor-io-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{returnTo?:string}>;
};

export default async function VendorIoPreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: vendorIo } = await supabase
    .from("vendor_ios")
    .select("id, document_number, campaign_header_id, terms_html")
    .eq("id", id)
    .maybeSingle();

  if (!vendorIo) {
    notFound();
  }

  const typed = vendorIo as {
    id: string;
    document_number: string | null;
    campaign_header_id: string;
    terms_html: string | null;
  };

  const html = await renderLiveVendorIoHtml(supabase, id);

  return (
    <DashboardShell
      containedMain hideDesktopHeader hidePageHeader
      title="Vendor IO Preview"
      description={`${typed.document_number ?? id} — branded insertion order`}
    >
      <DocumentPreviewClient
          closeHref={documentReturnPath(query.returnTo, `/ios/vendor?io=${id}`)}
          contained
          toolbarLeft={<PreviewDownloadMenu formats={[
            {format:"html",label:"HTML",href:`/api/vendor-ios/${id}/document?format=html&download=1`},
            {format:"pdf",label:"PDF",href:`/api/vendor-ios/${id}/document?format=pdf&download=1`},
          ]}/>}
        title={`Vendor IO ${typed.document_number ?? id}`}
        html={html}
      />
    </DashboardShell>
  );
}
