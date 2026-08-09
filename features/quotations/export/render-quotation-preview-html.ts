import type { SupabaseClient } from "@supabase/supabase-js";

import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import {
  embedQuotationDocumentAvatars,
  enrichQuotationDetailForExport,
  resolveQuotationExportSiteOrigin,
} from "@/features/quotations/export/quotation-export-avatars";
import {
  embedQuotationDocumentPublicationShots,
  loadQuotationCreatorPublicationShots,
} from "@/features/quotations/export/quotation-export-publications";
import { buildQuotationHtml } from "@/features/quotations/export/quotation-html";
import {
  isCreatorDeckTemplate,
  resolveQuotationTemplate,
  type QuotationTemplateVariant,
} from "@/features/quotations/export/quotation-template";
import { getQuotationDetail } from "@/features/quotations/queries";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import type { Database } from "@/types/database";

type AppSupabase = SupabaseClient<Database>;

/**
 * Server-side HTML for the quotation preview page (`srcDoc`).
 * Avoids navigating an iframe to `/api/.../export`, which is blocked by
 * Production `X-Frame-Options: DENY` / `frame-ancestors 'none'`.
 */
export async function renderQuotationPreviewHtml(
  supabase: AppSupabase,
  quotationId: string,
  options?: {
    template?: QuotationTemplateVariant | string | null;
    itemIds?: string[];
    platforms?: string[] | null;
    siteOrigin?: string;
  }
): Promise<{
  html: string;
  serial: string;
  template: QuotationTemplateVariant;
  creatorCount: number;
}> {
  const template = resolveQuotationTemplate(options?.template ?? null);
  const detail = await getQuotationDetail(quotationId);
  if (!detail) {
    throw new Error("Quotation not found");
  }

  const enriched = await enrichQuotationDetailForExport(supabase, detail);
  const publicationShotsByCreatorKey = isCreatorDeckTemplate(template)
    ? await loadQuotationCreatorPublicationShots(supabase, enriched.items)
    : undefined;
  const displayFxRateToEgp = await resolveRateToEgp(supabase, enriched.currency || "EGP");
  let doc = buildQuotationDocument(enriched, {
    template,
    itemIds: options?.itemIds,
    platforms: options?.platforms,
    publicationShotsByCreatorKey,
    displayFxRateToEgp,
  });
  doc = await embedQuotationDocumentAvatars(doc);
  doc = await embedQuotationDocumentPublicationShots(doc);

  const siteOrigin =
    options?.siteOrigin?.trim() ||
    resolveQuotationExportSiteOrigin(undefined, undefined);
  const html = buildQuotationHtml(doc, { siteOrigin });

  return {
    html,
    serial: doc.serial,
    template,
    creatorCount: doc.summary.creatorCount,
  };
}
