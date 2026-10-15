import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { asMetadataRecord } from "@/lib/commercial/client-original-currency";
import { approvedQuotationMutationError } from "@/lib/commercial-sync/rules";
import { quotationCreatorDuplicateKey } from "@/lib/quotations/quotation-creator-options";
import { readQuotationTemplatePhotos, TEMPLATE_PHOTOS_KEY, TEMPLATE_PHOTO_MAX_BYTES, TEMPLATE_PHOTO_DATA_MAX_LENGTH } from "@/lib/quotations/quotation-template-photos";

export async function normalizeQuotationTemplatePhoto(bytes: Buffer): Promise<string> {
  if (!bytes.length || bytes.length > TEMPLATE_PHOTO_MAX_BYTES) throw new Error("Choose a JPG, PNG or WebP photo up to 750 KB.");
  try {
    const input = sharp(bytes, { limitInputPixels: 25_000_000, animated: false });
    const meta = await input.metadata();
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new Error();
    const output = await input.rotate().resize(512, 768, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const data = `data:image/webp;base64,${output.toString("base64")}`;
    if (data.length > TEMPLATE_PHOTO_DATA_MAX_LENGTH) throw new Error();
    return data;
  } catch { throw new Error("This photo could not be read. Choose a smaller JPG, PNG or WebP image."); }
}

/** Authenticated staff client only: retain RLS, quotation ownership, edit locks and concurrency guard. */
export async function saveQuotationTemplatePhoto(supabase: SupabaseClient<Database>, quotationId: string, itemId: string, file: File | null) {
  if (!quotationId || !itemId) return { ok: false as const, message: "Choose a creator in this quotation." };
  const { data: quotation, error } = await supabase.from("quotations").select("metadata, updated_at, status, is_archived").eq("id", quotationId).maybeSingle();
  if (error || !quotation) return { ok: false as const, message: "Quotation not found or unavailable." };
  const locked = approvedQuotationMutationError(quotation.status);
  if (locked) return locked;
  if (quotation.is_archived || quotation.status === "archived") return { ok: false as const, message: "Archived quotations cannot be edited." };
  const { data: item, error: itemError } = await supabase.from("quotation_items")
    .select("id, unified_id, influencer_id, profile_id, creator_name, handle").eq("quotation_id", quotationId).eq("id", itemId).maybeSingle();
  if (itemError || !item) return { ok: false as const, message: "This creator is no longer in the quotation. Refresh and try again." };
  const key = quotationCreatorDuplicateKey(item);
  let photo: string | null = null;
  if (file) {
    if (file.size > TEMPLATE_PHOTO_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false as const, message: "Choose a JPG, PNG or WebP photo up to 750 KB." };
    try { photo = await normalizeQuotationTemplatePhoto(Buffer.from(await file.arrayBuffer())); }
    catch (cause) { return { ok: false as const, message: cause instanceof Error ? cause.message : "Could not read this photo." }; }
  }
  const metadata = asMetadataRecord(quotation.metadata);
  const photos = readQuotationTemplatePhotos(metadata);
  if (photo) photos[key] = photo; else delete photos[key];
  if (JSON.stringify(photos).length > 2_000_000) return { ok: false as const, message: "Template photos exceed 2 MB in total. Use smaller photos or restore an existing photo first." };
  if (Object.keys(photos).length) metadata[TEMPLATE_PHOTOS_KEY] = photos; else delete metadata[TEMPLATE_PHOTOS_KEY];
  const { data: updated, error: updateError } = await supabase.from("quotations")
    .update({ metadata, updated_at: new Date().toISOString() } as never).eq("id", quotationId)
    .eq("updated_at", quotation.updated_at).eq("status", quotation.status).eq("is_archived", false).select("id").maybeSingle();
  if (updateError) return { ok: false as const, message: "Could not save the template photo. Please try again." };
  if (!updated) return { ok: false as const, message: "The quotation changed while saving. Refresh and try again." };
  return { ok: true as const, photo };
}
