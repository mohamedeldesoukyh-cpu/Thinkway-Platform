import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  contentUrl: string | null;
  playwrightCapture?: (url: string) => Promise<Buffer | null>;
};

export async function tryPlaywrightScreenshot(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  const env = getScreenshotCaptureEnv();

  if (!env.playwrightEnabled) {
    return {
      source: "playwright",
      available: false,
      skippedReason: "METRICS_PLAYWRIGHT_ENABLED is not true.",
      durationMs: Date.now() - started,
    };
  }

  if (!ctx.playwrightCapture) {
    return {
      source: "playwright",
      available: false,
      skippedReason: "Playwright capture not available in this runtime.",
      durationMs: Date.now() - started,
    };
  }

  if (!ctx.contentUrl) {
    return {
      source: "playwright",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      durationMs: Date.now() - started,
    };
  }

  try {
    const imageBuffer = await ctx.playwrightCapture(ctx.contentUrl);
    if (!imageBuffer) {
      return {
        source: "playwright",
        available: true,
        error: "Playwright returned no screenshot.",
        errorCode: "playwright_empty",
        durationMs: Date.now() - started,
      };
    }
    return {
      source: "playwright",
      available: true,
      imageBuffer,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      source: "playwright",
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "playwright_error",
      durationMs: Date.now() - started,
    };
  }
}
