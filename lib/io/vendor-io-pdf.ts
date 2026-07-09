import { existsSync } from "node:fs";

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

const LOCAL_LAUNCH_ARGS = ["--no-sandbox", "--disable-setuid-sandbox"];

const PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
};

/** A4 portrait with CSS @page margins (performance reports). */
export const PERFORMANCE_REPORT_PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
};

export type HtmlToPdfOptions = {
  format: "A4";
  printBackground: boolean;
  preferCSSPageSize?: boolean;
  margin: { top: string; right: string; bottom: string; left: string };
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

function resolveLocalChromeExecutable(): string | undefined {
  const envPath = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }

  const candidates: string[] = [];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      candidates.push(`${localAppData}\\Google\\Chrome\\Application\\chrome.exe`);
    }
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser"
    );
  }

  return candidates.find((candidate) => existsSync(candidate));
}

async function launchLocalBrowser() {
  try {
    const puppeteer = await import("puppeteer");
    return await puppeteer.default.launch({
      headless: true,
      args: LOCAL_LAUNCH_ARGS,
    });
  } catch (bundledError) {
    console.warn("[vendor-io-pdf] Bundled Chromium launch failed", bundledError);
  }

  const executablePath = resolveLocalChromeExecutable();
  if (!executablePath) {
    throw new Error(
      "No local Chrome or Edge installation found. Install Google Chrome or set CHROME_PATH."
    );
  }

  const puppeteerCore = await import("puppeteer-core");
  return puppeteerCore.default.launch({
    executablePath,
    headless: true,
    args: LOCAL_LAUNCH_ARGS,
  });
}

async function launchBrowser() {
  if (isServerlessRuntime()) {
    return launchServerlessBrowser();
  }

  return launchLocalBrowser();
}

/**
 * Showcase quotations embed many large data-URI images. Chromium's default
 * `waitUntil: "load"` also waits on any leftover http(s) <img> requests
 * (CDN avatars that failed server-side embed), which routinely exceeds 30s.
 * Use domcontentloaded + a bounded network-idle settle instead.
 */
const PDF_SET_CONTENT_TIMEOUT_MS = 90_000;
const PDF_NETWORK_IDLE_TIMEOUT_MS = 5_000;

/** Server-side HTML → PDF via headless Chrome (local or Vercel serverless). */
export async function renderHtmlToPdf(
  html: string,
  options: HtmlToPdfOptions = PDF_OPTIONS
): Promise<PdfRenderResult> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // Abort remote image/font fetches that can hang `load` / network idle when
    // a Showcase export still contains a handful of unresolved CDN URLs.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      if (
        (resourceType === "image" || resourceType === "media" || resourceType === "font") &&
        (url.startsWith("http://") || url.startsWith("https://"))
      ) {
        void request.abort();
        return;
      }
      void request.continue();
    });
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: PDF_SET_CONTENT_TIMEOUT_MS,
    });
    try {
      await page.waitForNetworkIdle({
        idleTime: 500,
        timeout: PDF_NETWORK_IDLE_TIMEOUT_MS,
      });
    } catch {
      // Non-fatal: remaining external resources must not block PDF export.
    }
    const pdf = await page.pdf(options);
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
