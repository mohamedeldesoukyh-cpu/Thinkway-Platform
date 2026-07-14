import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  THINKWAY_LOGO_PUBLIC_PATHS,
  type ThinkwayReportLogoSrcs,
} from "@/lib/reports/document/thinkway-report-logo";

const dataUriCache = new Map<string, string>();

function loadPublicAssetDataUri(relativePath: string): string | null {
  const cached = dataUriCache.get(relativePath);
  if (cached) return cached;

  try {
    const filePath = join(process.cwd(), "public", relativePath.replace(/^\//, ""));
    const buffer = readFileSync(filePath);
    const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;
    dataUriCache.set(relativePath, dataUri);
    return dataUri;
  } catch {
    return null;
  }
}

/** Embed dark-background Thinkway logo as a data URI for Puppeteer-safe PDF export. */
export function getThinkwayLogoDarkDataUri(): string | null {
  return loadPublicAssetDataUri(THINKWAY_LOGO_PUBLIC_PATHS.dark);
}

/** Embed light-background Thinkway logo as a data URI for Puppeteer-safe PDF export. */
export function getThinkwayLogoLightDataUri(): string | null {
  return loadPublicAssetDataUri(THINKWAY_LOGO_PUBLIC_PATHS.light);
}

/** Resolve logo srcs for server-side PDF/HTML export (falls back to public paths). */
export function resolveThinkwayReportLogoSrcsForExport(): ThinkwayReportLogoSrcs {
  return {
    logoDarkSrc: getThinkwayLogoDarkDataUri() ?? THINKWAY_LOGO_PUBLIC_PATHS.dark,
    logoLightSrc: getThinkwayLogoLightDataUri() ?? THINKWAY_LOGO_PUBLIC_PATHS.light,
  };
}
