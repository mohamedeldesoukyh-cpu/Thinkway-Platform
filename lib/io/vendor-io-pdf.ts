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

/**
 * Client / Vendor Insertion Order PDFs — CSS @page controls margins.
 * Avoid stacking Puppeteer margins on top of template padding (whitespace).
 */
export const INSERTION_ORDER_PDF_OPTIONS: HtmlToPdfOptions = {
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
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

/** Durable Thinkway storage avatars may remain as https URLs when data-URI embed fails. */
function isAllowedPdfImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      (host === "supabase.co" || host.endsWith(".supabase.co")) &&
      parsed.pathname.includes("/storage/v1/object/")
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
    // All PDF types: inline remote <img> tags so Chromium never depends on CDN fetches.
    const { inlineRemoteImagesInHtml } = await import("@/lib/io/pdf-inline-remote-images");
    const pdfHtml = await inlineRemoteImagesInHtml(html);

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
    // matches the on-screen preview. Thinkway storage images may remain as https.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      if (
        (resourceType === "image" || resourceType === "media") &&
        (url.startsWith("http://") || url.startsWith("https://")) &&
        !isAllowedPdfImageUrl(url)
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
    await page.setContent(pdfHtml, {
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

export type HtmlPageLinkHotspot = {
  href: string;
  /** Relative to page width (0–1). */
  x: number;
  /** Relative to page height (0–1). */
  y: number;
  w: number;
  h: number;
};

export type HtmlPageImage = {
  buffer: Buffer;
  contentType: "png" | "jpeg";
  /** Clickable `<a href>` regions in page-relative coordinates. */
  links: HtmlPageLinkHotspot[];
};

export type HtmlPagesToImagesOptions = HtmlToPdfOptions & {
  pageSelector?: string;
  imageType?: "png" | "jpeg";
  quality?: number;
  deviceScaleFactor?: number;
};

export type HtmlPagesRenderResult =
  | { ok: true; pages: HtmlPageImage[] }
  | { ok: false; error: string };

/**
 * Capture each quotation slide page as an image (Preview/PDF visual parity for PPTX).
 * Selector defaults to `.cpage, .cover, .page`.
 */
export async function renderHtmlPagesToImages(
  html: string,
  options: HtmlPagesToImagesOptions = PDF_OPTIONS
): Promise<HtmlPagesRenderResult> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  const pageSelector = options.pageSelector ?? ".cpage, .cover, .page";
  const imageType = options.imageType ?? "jpeg";
  const quality = options.quality ?? 88;
  const deviceScaleFactor =
    options.deviceScaleFactor ?? options.viewport?.deviceScaleFactor ?? 1.5;

  try {
    const { inlineRemoteImagesInHtml } = await import("@/lib/io/pdf-inline-remote-images");
    const captureHtml = await inlineRemoteImagesInHtml(html);

    browser = await launchBrowser();
    const page = await browser.newPage();
    if (options.viewport) {
      await page.setViewport({
        width: options.viewport.width,
        height: options.viewport.height,
        deviceScaleFactor,
      });
    }
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      const resourceType = request.resourceType();
      if (
        (resourceType === "image" || resourceType === "media") &&
        (url.startsWith("http://") || url.startsWith("https://")) &&
        !isAllowedPdfImageUrl(url)
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
    await page.setContent(captureHtml, {
      waitUntil: "domcontentloaded",
      timeout: PDF_SET_CONTENT_TIMEOUT_MS,
    });
    try {
      await page.waitForNetworkIdle({
        idleTime: 500,
        timeout: PDF_NETWORK_IDLE_TIMEOUT_MS,
      });
    } catch {
      // Non-fatal
    }
    await waitForPdfAssetsReady(page);
    // Arabic creator names need Noto Sans Arabic glyphs (Inter has none).
    try {
      await page.waitForFunction(
        () =>
          document.fonts.check('16px "Noto Sans Arabic"') ||
          document.fonts.check("16px Noto Sans Arabic"),
        { timeout: 8_000 }
      );
    } catch {
      // Non-fatal when offline — system Arabic fonts may still render.
    }
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

    await page.addStyleTag({
      content: `
        html, body { background: #fff !important; }
        ${pageSelector} {
          break-after: auto !important;
          page-break-after: auto !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: relative !important;
          margin: 0 auto 16px !important;
        }
      `,
    });

    const handles = await page.$$(pageSelector);
    if (!handles.length) {
      return { ok: false, error: `No pages matched selector ${pageSelector}` };
    }

    const pages: HtmlPageImage[] = [];
    for (const handle of handles) {
      await handle.evaluate((el) => {
        el.scrollIntoView({ block: "start", inline: "nearest" });
      });
      const links = (await handle.evaluate((el) => {
        const pageRect = el.getBoundingClientRect();
        if (pageRect.width <= 0 || pageRect.height <= 0) return [];
        const anchors = Array.from(el.querySelectorAll("a[href]"));
        return anchors
          .map((anchor) => {
            const href = (anchor as HTMLAnchorElement).href?.trim() ?? "";
            if (!/^https?:\/\//i.test(href)) return null;
            const rect = anchor.getBoundingClientRect();
            if (rect.width <= 2 || rect.height <= 2) return null;
            return {
              href,
              x: (rect.left - pageRect.left) / pageRect.width,
              y: (rect.top - pageRect.top) / pageRect.height,
              w: rect.width / pageRect.width,
              h: rect.height / pageRect.height,
            };
          })
          .filter((row): row is NonNullable<typeof row> => row != null)
          .filter(
            (row) =>
              row.x < 1 &&
              row.y < 1 &&
              row.x + row.w > 0 &&
              row.y + row.h > 0 &&
              row.w > 0 &&
              row.h > 0
          );
      })) as HtmlPageLinkHotspot[];
      const buffer = Buffer.from(
        await handle.screenshot({
          type: imageType,
          ...(imageType === "jpeg" ? { quality } : {}),
        })
      );
      pages.push({ buffer, contentType: imageType, links });
    }
    return { ok: true, pages };
  } catch (error) {
    const message = formatError(error);
    console.error("[vendor-io-pdf] HTML page screenshots failed:", error);
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
