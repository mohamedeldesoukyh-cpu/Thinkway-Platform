import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Platforms that render as circular logo images in performance reports (IG/TT). */
const REPORT_PLATFORM_IMAGE_FILES: Record<string, string> = {
  instagram: "instagram.png",
  tiktok: "tiktok.png",
};

const dataUriCache = new Map<string, string>();

function normalizePlatformKey(platform: string): string {
  const value = platform.trim().toLowerCase();
  if (value === "ig") return "instagram";
  if (value === "tt") return "tiktok";
  return value;
}

function loadPlatformIconDataUri(platform: string): string | null {
  const key = normalizePlatformKey(platform);
  const filename = REPORT_PLATFORM_IMAGE_FILES[key];
  if (!filename) return null;

  const cached = dataUriCache.get(key);
  if (cached) return cached;

  const filePath = join(process.cwd(), "public", "platform-icons", filename);
  const buffer = readFileSync(filePath);
  const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  dataUriCache.set(key, dataUri);
  return dataUri;
}

export function getReportPlatformIconDataUri(platform: string): string | null {
  try {
    return loadPlatformIconDataUri(platform);
  } catch {
    return null;
  }
}

export function getReportPlatformIconTitle(platform: string): string {
  const key = normalizePlatformKey(platform);
  if (key === "instagram") return "Instagram";
  if (key === "tiktok") return "TikTok";
  return platform;
}
