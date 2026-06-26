import { notFound } from "next/navigation";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { renderLiveVendorIoHtml } from "@/lib/io/render-live-vendor-io-html";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VendorIoPreviewPage({ params }: PageProps) {
  const { id } = await params;
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
      title="Vendor IO Preview"
      description={`${typed.document_number ?? id} — branded insertion order`}
    >
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        <PageBackButton
          fallbackHref={`/ios/vendor?io=${id}`}
          label="Back to Vendor IOs"
        />
        <PageBackButton
          fallbackHref={`/campaigns/${typed.campaign_header_id}`}
          label="Campaign"
        />
        <a
          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
          href={`/api/vendor-ios/${id}/document?format=html`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Download HTML
        </a>
        <a
          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/40"
          href={`/api/vendor-ios/${id}/document?format=pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Download PDF
        </a>
      </div>
      <iframe
        title={`Vendor IO ${typed.document_number ?? id}`}
        srcDoc={html}
        className="min-h-[1200px] w-full rounded-xl border border-border bg-card"
      />
    </DashboardShell>
  );
}
