import type { HtmlPageImage } from "@/lib/io/vendor-io-pdf";

/** A4 landscape inches — matches quotation HTML `@page { size:297mm 210mm }` and PDF. */
export const QUOTATION_A4_LANDSCAPE = {
  name: "QUOTATION_A4_LANDSCAPE",
  widthIn: 297 / 25.4,
  heightIn: 210 / 25.4,
} as const;

export const PPTX_WIDESCREEN = { name: "LAYOUT_WIDE", widthIn: 40 / 3, heightIn: 7.5 } as const;

export async function buildPptxFromPageImages(
  pages: HtmlPageImage[],
  title: string,
  options?: { widescreen?: boolean }
): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  const layout = options?.widescreen ? PPTX_WIDESCREEN : QUOTATION_A4_LANDSCAPE;
  pptx.defineLayout({
    name: layout.name,
    width: layout.widthIn,
    height: layout.heightIn,
  });
  pptx.layout = layout.name;
  pptx.author = "Thinkway Platform";
  pptx.company = "Thinkway";
  pptx.title = title;

  const pageW = layout.widthIn;
  const pageH = layout.heightIn;

  for (const page of pages) {
    const slide = pptx.addSlide();
    // Fit the original page without stretching or cropping. PDF remains A4.
    const sourceRatio = QUOTATION_A4_LANDSCAPE.widthIn / QUOTATION_A4_LANDSCAPE.heightIn;
    const imageW = Math.min(pageW, pageH * sourceRatio);
    const imageH = imageW / sourceRatio;
    const offsetX = (pageW - imageW) / 2;
    const offsetY = (pageH - imageH) / 2;
    slide.background = { color: "FFFFFF" };
    slide.addImage({
      data: `image/${page.contentType};base64,${page.buffer.toString("base64")}`,
      x: offsetX,
      y: offsetY,
      w: imageW,
      h: imageH,
    });

    // Transparent hit targets on top of the screenshot (avatar, pubs, handles…).
    for (const link of page.links ?? []) {
      const x = offsetX + Math.max(0, link.x) * imageW;
      const y = offsetY + Math.max(0, link.y) * imageH;
      const w = Math.min(link.w, 1 - Math.max(0, link.x)) * imageW;
      const h = Math.min(link.h, 1 - Math.max(0, link.y)) * imageH;
      if (w < 0.05 || h < 0.05) continue;
      slide.addShape("rect", {
        x,
        y,
        w,
        h,
        fill: { color: "FFFFFF", transparency: 100 },
        line: { type: "none" },
        hyperlink: { url: link.href },
      });
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
