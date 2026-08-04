import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildShortlistDocument,
} from "@/features/discovery/shortlists/export/shortlist-document";
import {
  embedShortlistDocumentAvatars,
  resolveShortlistExportSiteOrigin,
} from "@/features/discovery/shortlists/export/shortlist-export-avatars";
import {
  embedShortlistDocumentPublicationShots,
  loadShortlistCreatorPublicationShots,
} from "@/features/discovery/shortlists/export/shortlist-export-publications";
import { buildShortlistHtml } from "@/features/discovery/shortlists/export/shortlist-html";
import {
  isCreatorDeckTemplate,
  resolveShortlistTemplate,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";
import { getShortlistDetail } from "@/features/discovery/shortlists/queries";
import type { Database } from "@/types/database";

type AppSupabase = SupabaseClient<Database>;

/**
 * Server-side HTML for the shortlist preview page (`srcDoc`).
 * Avoids iframe navigation to the export API under Production framing DENY.
 */
export async function renderShortlistPreviewHtml(
  supabase: AppSupabase,
  shortlistId: string,
  options?: {
    template?: ShortlistTemplateVariant | string | null;
    itemIds?: string[];
    siteOrigin?: string;
  }
): Promise<{
  html: string;
  serial: string;
  template: ShortlistTemplateVariant;
  creatorCount: number;
}> {
  const template = resolveShortlistTemplate(options?.template ?? null);
  const detail = await getShortlistDetail(shortlistId);
  if (!detail) {
    throw new Error("Shortlist not found");
  }

  const itemIds = options?.itemIds?.filter(Boolean);
  const filteredItems =
    itemIds && itemIds.length > 0
      ? detail.creators.filter((item) => itemIds.includes(item.item_id))
      : detail.creators;

  const publicationShotsByCreatorKey = isCreatorDeckTemplate(template)
    ? await loadShortlistCreatorPublicationShots(supabase, filteredItems)
    : undefined;

  let doc = buildShortlistDocument(detail, {
    template,
    itemIds,
    publicationShotsByCreatorKey,
  });
  doc = await embedShortlistDocumentAvatars(doc);
  doc = await embedShortlistDocumentPublicationShots(doc);

  const siteOrigin =
    options?.siteOrigin?.trim() ||
    resolveShortlistExportSiteOrigin(undefined, undefined);
  const html = buildShortlistHtml(doc, { siteOrigin });

  return {
    html,
    serial: detail.serial_number ?? "SL-PENDING",
    template,
    creatorCount: doc.summary.creatorCount,
  };
}
