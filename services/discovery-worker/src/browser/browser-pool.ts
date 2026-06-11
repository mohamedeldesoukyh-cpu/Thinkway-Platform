import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { config } from "../config.js";
import { detectCaptcha } from "../anti-bot/captcha.js";
import { nextProxyUrl } from "../anti-bot/proxy.js";
import { randomizedDelay } from "../anti-bot/delays.js";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: config.headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export async function withPage<T>(
  fn: (page: Page) => Promise<T>,
  url?: string
): Promise<T> {
  const b = await getBrowser();
  const proxy = nextProxyUrl();
  const context: BrowserContext = await b.newContext({
    userAgent: config.userAgent,
    viewport: { width: 1280, height: 800 },
    proxy: proxy ? { server: proxy } : undefined,
  });
  const page = await context.newPage();
  try {
    if (url) {
      await randomizedDelay();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      const html = await page.content();
      const title = await page.title();
      const captcha = detectCaptcha(html, title);
      if (captcha.detected) {
        throw new Error(`Captcha detected: ${captcha.reason}`);
      }
    }
    return await fn(page);
  } finally {
    await context.close();
  }
}

export async function fetchPublicHtml(url: string): Promise<string> {
  return withPage(async (page) => page.content(), url);
}

export async function shutdownBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
