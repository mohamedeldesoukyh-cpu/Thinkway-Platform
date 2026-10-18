import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Called after shortlist ownership and edit-lock checks, using the authenticated RLS client. */
export async function saveShortlistTemplatePhoto(supabase: SupabaseClient<Database>, id: string, itemId: string, form: FormData, row: {metadata: Record<string, unknown>; updated_at: string; status: Database["public"]["Tables"]["discovery_shortlists"]["Row"]["status"]}) {
  const { data: item, error: itemError } = await supabase.from("discovery_shortlist_items").select("id").eq("shortlist_id", id).eq("id", itemId).maybeSingle();
  if (itemError || !item) return { ok: false as const, message: "Creator not found in this shortlist." };
  const { readQuotationTemplatePhotos, TEMPLATE_PHOTOS_KEY, TEMPLATE_PHOTO_MAX_BYTES } = await import("@/lib/quotations/quotation-template-photos");
  let photo: string | null = null;
  if (form.get("reset") !== "true") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size > TEMPLATE_PHOTO_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false as const, message: "Choose a JPG, PNG or WebP photo up to 750 KB." };
    const { normalizeQuotationTemplatePhoto } = await import("@/lib/services/quotations/quotation-template-photo-service");
    try { photo = await normalizeQuotationTemplatePhoto(Buffer.from(await file.arrayBuffer())); }
    catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : "Could not read this photo." }; }
  }
  const metadata = { ...row.metadata };
  const photos = readQuotationTemplatePhotos(metadata);
  if (photo) photos[itemId] = photo; else delete photos[itemId];
  if (JSON.stringify(photos).length > 2_000_000) return { ok: false as const, message: "Template photos exceed 2 MB in total. Use smaller photos or reset an existing photo." };
  if (Object.keys(photos).length) metadata[TEMPLATE_PHOTOS_KEY] = photos; else delete metadata[TEMPLATE_PHOTOS_KEY];
  const { data, error } = await supabase.from("discovery_shortlists")
    .update({ metadata: metadata as Database["public"]["Tables"]["discovery_shortlists"]["Update"]["metadata"] })
    .eq("id", id).eq("updated_at", row.updated_at).eq("status", row.status).eq("is_archived", false).select("id").maybeSingle();
  if (error) return { ok: false as const, message: "Could not save the photo. Please try again." };
  if (!data) return { ok: false as const, message: "The shortlist changed. Refresh and try again." };
  return { ok: true as const, photo };
}
