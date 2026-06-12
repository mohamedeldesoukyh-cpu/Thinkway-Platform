import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";
import { loadClientIoDocumentData } from "@/lib/io/client-io-document-data";
import { renderClientIoHtml } from "@/lib/io/client-io-template-render";

/** Always renders from current platform data (campaign lines, deliverables, client billing). */
export async function renderLiveClientIoHtml(
  supabase: SupabaseClient,
  clientIoId: string,
  layout: ClientIoDocumentLayout = "detailed"
): Promise<string> {
  const data = await loadClientIoDocumentData(supabase, clientIoId);
  return renderClientIoHtml(data, layout);
}
