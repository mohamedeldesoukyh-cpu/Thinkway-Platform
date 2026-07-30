import { existsSync } from "node:fs";

import { SLIDE_DECK_PAGE } from "@/lib/io/slide-deck-page";

export { SLIDE_DECK_PAGE } from "@/lib/io/slide-deck-page";

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

/** Slide-deck documents that declare their own @page size (campaign proposals). */
export const SLIDE_DECK_PDF_OPTIONS: HtmlToPdfOptions = {
  width: SLIDE_DECK_PAGE.widthIn,
  height: SLIDE_DECK_PAGE.heightIn,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
  viewport: {
    width: SLIDE_DECK_PAGE.widthPx,
    height: SLIDE_DECK_PAGE.heightPx,
    deviceScaleFactor: 1,
  },
};

export type HtmlToPdfOptions = {
  format?: "A4";
  width?: string;
  height?: string;
  printBackground: boolean;
  preferCSSPageSize?: boolean;
  margin: { top: string; right: string; bottom: string; left: string };
  viewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };
  /**
   * Wait for a documentElement attribute (e.g. pagination engine ready)
   * before calling page.pdf(). Layout must already be finalized in the DOM.
   */
  waitForDocumentAttribute?: {
    name: string;
    value: string;
    timeoutMs?: number;
  };
  /**
   * Measure auto-height slides and emit matching named `@page` sizes so
   * Chromium PDF does not clip tall content (e.g. media-plan calendar).
   */
  sizeAutoHeightPages?: {
    selector: string;
    widthPx: number;
  };
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
  const executablePath = resolveLocalChromeExecutable();

  if (!executablePath) {
    throw new Error(
      "No local Chrome or Edge installation found. Install Google Chrome or set CHROME_PATH."
    );
  }

  const puppeteer = await import("puppeteer-core");

  return puppeteer.default.launch({
    executablePath,
    headless: true,
    args: LOCAL_LAUNCH_ARGS,
    defaultViewport: PDF_VIEWPORT,
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
const PDF_ASSETS_READY_TIMEOUT_MS = 8_000;

function isAllowedPdfFontUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "fonts.googleapis.com" ||
      host === "fonts.gstatic.com" ||
      host.endsWith(".googleapis.com") ||
      host.endsWith(".gstatic.com")
    );
  } catch {
    return false;
  }
}

async function waitForPdfAssetsReady(page: {
  evaluate: (pageFunction: () => Promise<void>) => Promise<void>;
}): Promise<void> {
  await Promise.race([
    page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      const images = Array.from(document.images);
      await Promise.all(
        images.map(async (img) => {
          if (img.complete) {
            if (typeof img.decode === "function") {
              try {
                await img.decode();
              } catch {
                // Broken/decorative images must not block PDF export.
              }
            }
            return;
          }
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        })
      );
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, PDF_ASSETS_READY_TIMEOUT_MS);
    }),
  ]);
}

async function sizeAutoHeightPagesForPdf(
  page: {
    evaluate: <T>(
      pageFunction: (config: { selector: string; widthPx: number }) => T,
      arg: { selector: string; widthPx: number }
    ) => Promise<T>;
  },
  config: { selector: string; widthPx: number }
): Promise<void> {
  await page.evaluate((cfg) => {
    const nodes = Array.from(document.querySelectorAll(cfg.selector));
    if (!nodes.length) return;

    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-pdf-auto-page-size", "true");
    const rules: string[] = [];

    nodes.forEach((node, index) => {
      const el = node as HTMLElement;
      el.style.height = "auto";
      el.style.minHeight = "0";
      el.style.overflow = "visible";
      // Force layout before measuring the natural slide height.
      void el.offsetHeight;
      const height = Math.max(1, Math.ceil(Math.max(el.scrollHeight, el.getBoundingClientRect().height)));
      const pageName = `autosize${index}`;
      const existing = (el.getAttribute("style") ?? "")
        .replace(/(?:^|;)\s*page\s*:\s*[^;]+/gi, "")
        .replace(/(?:^|;)\s*height\s*:\s*[^;]+/gi, "")
        .replace(/(?:^|;)\s*min-height\s*:\s*[^;]+/gi, "")
        .replace(/(?:^|;)\s*overflow\s*:\s*[^;]+/gi, "")
        .replace(/^;\s*/, "")
        .replace(/;\s*$/, "");
      const next = [
        existing,
        `page: ${pageName}`,
        `height: ${height}px`,
        `min-height: ${height}px`,
        "overflow: hidden",
      ]
        .filter(Boolean)
        .join("; ");
      el.setAttribute("style", `${next};`);
      rules.push(`@page ${pageName} { size: ${cfg.widthPx}px ${height}px; margin: 0; }`);
    });

    styleEl.textContent = rules.join("\n");
    document.head.appendChild(styleEl);
  }, config);
}

/** Server-side HTML → PDF via headless Chrome (local or Vercel serverless). */
export async function renderHtmlToPdf(
  html: string,
  options: HtmlToPdfOptions = PDF_OPTIONS
): Promise<PdfRenderResult> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    if (options.viewport) {
      await page.setViewport({
        width: options.viewport.width,
        height: options.viewport.height,
        deviceScaleFactor: options.viewport.deviceScaleFactor ?? 1,
      });
    }
    // Abort remote image/media fetches that can hang when a Showcase export
    // still contains unresolved CDN URLs. Allow Google Fonts so PDF typography
    // matches the on-screen preview.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      if (
        (resourceType === "image" || resourceType === "media") &&
        (url.startsWith("http://") || url.startsWith("https://"))
      ) {
        void request.abort();
        return;
      }
      if (
        resourceType === "font" &&
        (url.startsWith("http://") || url.startsWith("https://")) &&
        !isAllowedPdfFontUrl(url)
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
    await waitForPdfAssetsReady(page);
    if (options.waitForDocumentAttribute) {
      const { name, value, timeoutMs = 30_000 } = options.waitForDocumentAttribute;
      await page.waitForFunction(
        (attrName: string, attrValue: string) =>
          document.documentElement.getAttribute(attrName) === attrValue,
        { timeout: timeoutMs },
        name,
        value
      );
    }
    if (options.sizeAutoHeightPages) {
      await sizeAutoHeightPagesForPdf(page, options.sizeAutoHeightPages);
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
