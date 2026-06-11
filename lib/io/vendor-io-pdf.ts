const PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
};

async function launchBrowser() {
  const isServerless = process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerless) {
    const chromium = await import("@sparticuz/chromium");
    const puppeteer = await import("puppeteer-core");

    chromium.default.setGraphicsMode = false;

    const args = await puppeteer.default.defaultArgs({
      args: chromium.default.args,
      headless: "shell",
    });

    return puppeteer.default.launch({
      args,
      defaultViewport: {
        deviceScaleFactor: 1,
        hasTouch: false,
        height: 1080,
        isLandscape: true,
        isMobile: false,
        width: 1920,
      },
      executablePath: await chromium.default.executablePath(),
      headless: "shell",
    });
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/** Server-side HTML → PDF via headless Chrome (local or Vercel serverless). */
export async function renderHtmlToPdf(html: string): Promise<Buffer | null> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf(PDF_OPTIONS);
    return Buffer.from(pdf);
  } catch (error) {
    console.warn("[vendor-io-pdf] PDF generation unavailable", error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
