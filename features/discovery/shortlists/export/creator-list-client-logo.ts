import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";

/** Reuse the client's registered brand asset, embedded for offline downloads. */
export async function loadCreatorListClientLogo(supabase: SupabaseClient, clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const { data, error } = await supabase.from("clients").select("logo_url").eq("id", clientId).maybeSingle();
  if (error) throw new Error("Could not load the client logo. Please retry the export.");
  if (!data?.logo_url) return null;
  const embedded = await embedReportImageDataUri(data.logo_url);
  if (!embedded?.startsWith("data:image/")) throw new Error("Could not embed the client logo for offline export. Please retry.");
  // Convert registered SVG/other image assets to a self-contained raster image.
  // Client artwork keeps its original colours and needs no external resources.
  const payload = embedded.match(/^data:image\/[^;]+;base64,([\s\S]+)$/)?.[1];
  if (!payload) throw new Error("The client logo could not be prepared for offline export.");
  const png = await sharp(Buffer.from(payload, "base64")).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
