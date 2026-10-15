import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { quotationCreatorDuplicateKey } from "./quotation-creator-options";

export const TEMPLATE_PHOTOS_KEY = "templateCreatorPhotos";
export const TEMPLATE_PHOTO_MAX_BYTES = 750_000;
export const TEMPLATE_PHOTO_DATA_MAX_LENGTH = 180_000;
export type QuotationTemplatePhotos = Record<string, string>;

/** Only normalized raster data is accepted. This map is never a creator profile update. */
export function readQuotationTemplatePhotos(metadata: unknown): QuotationTemplatePhotos {
  const value = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)[TEMPLATE_PHOTOS_KEY] : null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, photo]) => key.length <= 512 && typeof photo === "string"
    && photo.length <= TEMPLATE_PHOTO_DATA_MAX_LENGTH && /^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(photo)));
}

/** Clone only for document rendering; staff rows and shared client profiles retain their originals. */
export function applyQuotationTemplatePhotos<T extends QuotationItemRow>(items: T[], photos?: QuotationTemplatePhotos): T[] {
  return items.map(item => {
    const photo = photos?.[quotationCreatorDuplicateKey(item)];
    if (!photo) return item;
    return { ...item, profile_image_url: photo, ...(item.creator_profile_source
      ? { creator_profile_source: { ...item.creator_profile_source, avatarUrl: photo } } : {}) };
  });
}
