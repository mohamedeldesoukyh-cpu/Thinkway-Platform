import { Suspense } from "react";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { ShortlistPreviewDownloads } from "@/features/discovery/shortlists/components/shortlist-preview-downloads";
import { ShortlistPreviewTemplateToggle } from "@/features/discovery/shortlists/components/shortlist-preview-template-toggle";
import { shortlistDetailPath } from "@/features/discovery/shortlists/constants";
import {
  buildShortlistDocument,
  embedShortlistDocumentAvatars,
} from "@/features/discovery/shortlists/export/shortlist-document";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import { resolveShortlistTemplate } from "@/features/discovery/shortlists/export/shortlist-template";
import { getShortlistDetail } from "@/features/discovery/shortlists/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/uuid";

type ShortlistPreviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string; items?: string }>;
};

export default async function ShortlistPreviewPage({
  params,
  searchParams,
}: ShortlistPreviewPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const template = resolveShortlistTemplate(query.template);
  const itemIds = query.items
    ? query.items.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

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

  const detail = await getShortlistDetail(id);
  if (!detail) {
    notFound();
  }

  const templateLabel = template === "detailed" ? "Detailed" : "Summary";
  const doc = await embedShortlistDocumentAvatars(
    buildShortlistDocument(detail, { template, itemIds })
  );
  const html = buildShortlistHtml(doc);

  return (
    <DashboardShell
      title="Shortlist preview"
      description={`${doc.serial} — ${templateLabel.toLowerCase()} creator roster`}
      hidePageHeader
    >
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:-mx-8 md:px-8 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PageBackButton
              fallbackHref={shortlistDetailPath(id)}
              label="Back to shortlist"
              variant="text"
            />
            <Suspense fallback={null}>
              <ShortlistPreviewTemplateToggle
                shortlistId={id}
                activeTemplate={template}
                itemIds={itemIds}
              />
            </Suspense>
          </div>
          <ShortlistPreviewDownloads
            shortlistId={id}
            template={template}
            itemIds={itemIds}
          />
        </div>
      </div>

      <iframe
        title={`${templateLabel} shortlist ${doc.serial}`}
        srcDoc={html}
        className="min-h-[1200px] w-full rounded-xl border border-border bg-card"
      />
    </DashboardShell>
  );
}
