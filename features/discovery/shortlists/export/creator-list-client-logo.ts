import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";

/** Reuse the client's registered brand asset, embedded for offline downloads. */
export async function loadCreatorListClientIdentity(supabase: SupabaseClient, clientId: string | null, whiteOnDark = false): Promise<{ name: string; logo: string | null } | null> {
  if (!clientId) return null;
  const { data, error } = await supabase.from("clients").select("name, logo_url, group_id").eq("id", clientId).maybeSingle();
  if (error) throw new Error("Could not load the client logo. Please retry the export.");
  if (!data) return null;
  let name = data.name?.trim() || "Client";
  let logoUrl = data.logo_url;
  if (data.group_id) {
    const { data: group, error: groupError } = await supabase.from("groups").select("name, logo_url").eq("id", data.group_id).maybeSingle();
    if (groupError) throw new Error("Could not load the client group. Please retry the export.");
    if (group?.name?.trim()) {
      name = group.name.trim();
      logoUrl = group.logo_url;
    }
  }
  if (!logoUrl) return { name, logo: null };
  const embedded = await embedReportImageDataUri(logoUrl);
  if (!embedded?.startsWith("data:image/")) throw new Error("Could not embed the client logo for offline export. Please retry.");
  // Convert registered SVG/other image assets to a self-contained raster image.
  // Client artwork keeps its original colours and needs no external resources.
  const payload = embedded.match(/^data:image\/[^;]+;base64,([\s\S]+)$/)?.[1];
  if (!payload) throw new Error("The client logo could not be prepared for offline export.");
  let png = await sharp(Buffer.from(payload, "base64")).png().toBuffer();
  if (whiteOnDark) {
    const { data: pixels, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const corners = [0, (info.width - 1) * 4, (info.height - 1) * info.width * 4, (info.width * info.height - 1) * 4];
    const whiteBackground = corners.every(i => pixels[i] > 240 && pixels[i+1] > 240 && pixels[i+2] > 240 && pixels[i+3] > 240);
    for (let i = 0; i < pixels.length; i += 4) {
      if (whiteBackground) pixels[i+3] = Math.round(pixels[i+3] * (1 - Math.min(pixels[i],pixels[i+1],pixels[i+2]) / 255));
      pixels[i] = pixels[i+1] = pixels[i+2] = 255;
    }
    png = await sharp(pixels, {raw:info}).png().toBuffer();
  }
  return { name, logo: `data:image/png;base64,${png.toString("base64")}` };
}

/** Shared group-first artwork for list reports. Text remains available without artwork. */
export async function loadCreatorListClientLogo(supabase: SupabaseClient, clientId: string | null, whiteOnDark = false): Promise<string | null> {
  return (await loadCreatorListClientIdentity(supabase, clientId, whiteOnDark))?.logo ?? null;
}
