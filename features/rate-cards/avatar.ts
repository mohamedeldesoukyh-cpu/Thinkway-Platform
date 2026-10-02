import sharp from "sharp";
import { fetchWithStrictRedirects, SOCIAL_MEDIA_SRC_ALLOWLIST } from "@/lib/security/ssrf";

export const AVATAR_MAX_BYTES = 750_000;

/** Persist only decoded raster pixels, never executable SVG or remote HTML. */
export async function normalizeRateAvatar(bytes: Buffer): Promise<string> {
  if (!bytes.length || bytes.length > AVATAR_MAX_BYTES) throw new Error("avatarInvalid");
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, animated: false });
    const meta = await image.metadata();
    if (!meta.format || !["jpeg", "png", "webp", "gif", "avif"].includes(meta.format)) throw new Error();
    const output = await image.rotate().resize(512, 512, { fit: "cover", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (output.length > AVATAR_MAX_BYTES) throw new Error();
    return `data:image/webp;base64,${output.toString("base64")}`;
  } catch { throw new Error("avatarInvalid"); }
}

export async function readRateAvatarLink(url: string): Promise<Buffer> {
  try {
    const response = await fetchWithStrictRedirects(url, { allowlist: SOCIAL_MEDIA_SRC_ALLOWLIST, timeoutMs: 10_000, maxRedirects: 3 });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > AVATAR_MAX_BYTES) throw new Error();
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks);
  } catch { throw new Error("avatarLinkError"); }
}
