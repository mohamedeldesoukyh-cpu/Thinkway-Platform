/** Server-side HTML → PDF via headless Chrome when available. */
export async function renderHtmlToPdf(html: string): Promise<Buffer | null> {
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.warn("[vendor-io-pdf] PDF generation unavailable", error);
    return null;
  }
}
