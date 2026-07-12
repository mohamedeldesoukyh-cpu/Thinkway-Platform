import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { QuotationPreviewDownloads } from "@/features/quotations/components/quotation-preview-downloads";
import { QuotationPreviewTemplateToggle } from "@/features/quotations/components/quotation-preview-template-toggle";
import { quotationDetailPath } from "@/features/quotations/constants";
import {
  appendQuotationExportRevision,
  resolveQuotationTemplate,
} from "@/features/quotations/export/quotation-template";
import { getQuotationDetail } from "@/features/quotations/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

export const dynamic = "force-dynamic";

type QuotationPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
};

function quotationTemplateLabel(
  template: ReturnType<typeof resolveQuotationTemplate>
): string {
  switch (template) {
    case "lump-sum":
      return "Lump sum";
    case "showcase":
      return "Showcase";
    case "showcase-lump-sum":
      return "Showcase Lump Sum";
    default:
      return "Detailed";
  }
}

export default async function QuotationPreviewPage({
  params,
  searchParams,
}: QuotationPreviewPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const template = resolveQuotationTemplate(query.template);

  if (!isUuid(id)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const detail = await getQuotationDetail(id);
  if (!detail) {
    notFound();
  }

  const templateLabel = quotationTemplateLabel(template);
  const serial = detail.serial_number ?? "QT-PENDING";
  const previewParams = new URLSearchParams({ format: "preview" });
  if (template !== "detailed") {
    previewParams.set("template", template);
  }
  appendQuotationExportRevision(previewParams, detail.updated_at);
  const previewSrc = `/api/quotations/${id}/export?${previewParams.toString()}`;

  return (
    <DashboardShell
      title="Quotation preview"
      description={`${serial} — ${templateLabel.toLowerCase()} client quotation`}
      hidePageHeader
    >
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PageBackButton
              fallbackHref={quotationDetailPath(id)}
              label="Back to quotation"
              variant="text"
            />
            <Suspense fallback={null}>
              <QuotationPreviewTemplateToggle
                quotationId={id}
                activeTemplate={template}
              />
            </Suspense>
          </div>
          <QuotationPreviewDownloads
            quotationId={id}
            template={template}
            exportRevision={detail.updated_at}
          />
        </div>
      </div>

      <iframe
        title={`${templateLabel} quotation ${serial}`}
        src={previewSrc}
        className="min-h-[1200px] w-full rounded-xl border border-border bg-card"
      />
    </DashboardShell>
  );
}
