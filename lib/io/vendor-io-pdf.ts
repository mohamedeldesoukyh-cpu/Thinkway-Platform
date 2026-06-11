const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

const PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
};

const PDF_VIEWPORT = {
  deviceScaleFactor: 1,
  hasTouch: false,
  height: 1080,
  isLandscape: true,
  isMobile: false,
  width: 1920,
};

export type PdfRenderResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; error: string };

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isServerlessRuntime(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launchServerlessBrowser() {
  const chromium = await import("@sparticuz/chromium-min");
  const puppeteer = await import("puppeteer-core");

  chromium.default.setGraphicsMode = false;

  const executablePath = await chromium.default.executablePath(CHROMIUM_PACK_URL);
  const args = await puppeteer.default.defaultArgs({
    args: chromium.default.args,
    headless: "shell",
  });

  return puppeteer.default.launch({
    args,
    defaultViewport: PDF_VIEWPORT,
    executablePath,
    headless: "shell",
  });
}

async function launchLocalBrowser() {
  try {
    const puppeteer = await import("puppeteer");
    return await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  } catch (localError) {
    console.warn("[vendor-io-pdf] Local puppeteer unavailable, using chromium-min", localError);
    return launchServerlessBrowser();
  }
}

async function launchBrowser() {
  if (isServerlessRuntime()) {
    return launchServerlessBrowser();
  }

  return launchLocalBrowser();
}

/** Server-side HTML → PDF via headless Chrome (local or Vercel serverless). */
export async function renderHtmlToPdf(html: string): Promise<PdfRenderResult> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf(PDF_OPTIONS);
    return { ok: true, buffer: Buffer.from(pdf) };
  } catch (error) {
    const message = formatError(error);
    console.error("[vendor-io-pdf] PDF generation failed:", error);
    return { ok: false, error: message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export function pdfUnavailableMessage(detail: string): string {
  if (process.env.NODE_ENV === "development") {
    return detail;
  }

  return "PDF generation unavailable. Download HTML instead or try again shortly.";
}
