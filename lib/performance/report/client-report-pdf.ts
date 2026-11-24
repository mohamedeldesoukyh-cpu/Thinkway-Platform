import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFNull, PrintScaling } from "pdf-lib";

/** Export copies only: stored publication screenshots remain untouched. */
export async function prepareClientReportHtml(html: string): Promise<string> {
  const faces = await Promise.all([
    ...[400, 600, 700, 800].map(weight => ({ family: "Inter", weight })),
    ...[400, 700].map(weight => ({ family: "NotoSansArabic", weight })),
  ].map(async ({ family, weight }) => {
    const font = await readFile(path.join(process.cwd(), "public/report-assets/performance-fonts", `${family}-${weight}.ttf`));
    return `@font-face{font-family:'${family === "Inter" ? "Inter" : "Noto Sans Arabic"}';font-style:normal;font-weight:${weight};src:url(data:font/ttf;base64,${font.toString("base64")}) format('truetype');font-display:block}`;
  }));
  html = html.replace(/@import url\(['"]https:\/\/fonts\.googleapis\.com[^'"]+['"]\);/g, faces.join("\n"));
  const images = [...new Set(html.match(/data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+/g) ?? [])];
  for (let offset = 0; offset < images.length; offset += 4) {
    const replacements = await Promise.all(images.slice(offset, offset + 4).map(async uri => {
      const original = Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
      try {
        const metadata = await sharp(original).metadata();
        const pipeline = sharp(original).rotate().resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true });
        const alpha = metadata.hasAlpha;
        const buffer = await (alpha ? pipeline.png({ compressionLevel: 9 }) : pipeline.jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: "4:4:4" })).toBuffer();
        return [uri, buffer.length < original.length ? `data:image/${alpha ? "png" : "jpeg"};base64,${buffer.toString("base64")}` : uri] as const;
      } catch { return [uri, uri] as const; }
    }));
    for (const [before, after] of replacements) html = html.replaceAll(before, after);
  }
  return html;
}

/** Explicit actual-size opening and printing; viewers may override their own defaults. */
export async function setClientReportActualSize(bytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes);
  pdf.catalog.set(PDFName.of("OpenAction"), pdf.context.obj([pdf.getPage(0).ref, "XYZ", PDFNull, PDFNull, 1]));
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  return pdf.save({ useObjectStreams: true });
}
