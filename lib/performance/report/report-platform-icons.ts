import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Platforms that render as circular logo images in HTML/PDF reports. */
const REPORT_PLATFORM_IMAGE_FILES: Record<string, string> = {
  instagram: "instagram.png",
  tiktok: "tiktok.png",
  facebook: "facebook.svg",
  youtube: "youtube.svg",
};

const dataUriCache = new Map<string, string>();

function normalizePlatformKey(platform: string): string {
  const value = platform.trim().toLowerCase();
  if (value === "ig") return "instagram";
  if (value === "tt") return "tiktok";
  if (value === "yt") return "youtube";
  if (value === "fb") return "facebook";
  if (value.startsWith("instagram_") || value.startsWith("ig_")) return "instagram";
  if (value.startsWith("tiktok_") || value.startsWith("tt_")) return "tiktok";
  if (value.startsWith("youtube_") || value.startsWith("yt_")) return "youtube";
  if (value.startsWith("facebook_") || value.startsWith("fb_")) return "facebook";
  return value;
}

function mimeTypeForFilename(filename: string): string {
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

function loadPlatformIconDataUri(platform: string): string | null {
  const key = normalizePlatformKey(platform);
  const filename = REPORT_PLATFORM_IMAGE_FILES[key];
  if (!filename) return null;

  const cached = dataUriCache.get(key);
  if (cached) return cached;

  const filePath = join(process.cwd(), "public", "platform-icons", filename);
  const buffer = readFileSync(filePath);
  const mime = mimeTypeForFilename(filename);
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
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
  if (key === "facebook") return "Facebook";
  if (key === "youtube") return "YouTube";
  return platform;
}
