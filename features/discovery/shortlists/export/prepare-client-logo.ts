import sharp from "sharp";

/** Cover artwork is at most 420 CSS px wide; keep ample print resolution without
 * decoding the original (sometimes 9,000+ px) artwork on every PDF page. */
export async function prepareClientLogo(buffer: Buffer, whiteOnDark: boolean): Promise<Buffer> {
  let png = await sharp(buffer).resize({ width: 1260, height: 1260, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  if (!whiteOnDark) return png;
  const { data: pixels, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [0, (info.width - 1) * 4, (info.height - 1) * info.width * 4, (info.width * info.height - 1) * 4];
  const whiteBackground = corners.every(i => pixels[i] > 240 && pixels[i+1] > 240 && pixels[i+2] > 240 && pixels[i+3] > 240);
  for (let i = 0; i < pixels.length; i += 4) {
    if (whiteBackground) pixels[i+3] = Math.round(pixels[i+3] * (1 - Math.min(pixels[i],pixels[i+1],pixels[i+2]) / 255));
    pixels[i] = pixels[i+1] = pixels[i+2] = 255;
  }
  png = await sharp(pixels, {raw:info}).png().toBuffer();
  return png;
}
