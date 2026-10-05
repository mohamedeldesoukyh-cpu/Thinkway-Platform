import sharp from "sharp";

/** Reports need thumbnails, not the original multi-megabyte profile image. */
export async function compactReportAvatar(data: string | null): Promise<string | null> {
  if (!data) return null;
  const match = /^data:image\/[^;,]+;base64,([\s\S]+)$/.exec(data);
  if (!match) return null;
  try {
    const output = await sharp(Buffer.from(match[1], "base64"), {limitInputPixels:25_000_000,animated:false})
      .rotate().resize(320,320,{fit:"inside",withoutEnlargement:true}).webp({quality:70}).toBuffer();
    return `data:image/webp;base64,${output.toString("base64")}`;
  } catch { return null; }
}
