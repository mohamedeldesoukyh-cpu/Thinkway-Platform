/**
 * Embed client logo and creator avatars as data URIs for proposal PDF export.
 * Headless Chromium cannot load Supabase or social CDN URLs; preview keeps remote URLs.
 */
import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import {
  compressExportDataUri,
  type CompressExportImageOptions,
} from "@/lib/io/compress-export-image";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { toUnprocessedImageDataUri } from "@/lib/performance/report/embed-publication-previews";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";

import type { ProposalVendor } from "./campaign-proposal-document";

const CLIENT_LOGO_COMPRESS: CompressExportImageOptions = {
  maxEdge: 240,
  quality: 80,
};

const embedCache = new Map<string, string | null>();

function resolveEmbeddedUrl(embedded: string | null): string | undefined {
  return embedded?.startsWith("data:") ? embedded : undefined;
}

async function resolveExportAvatarSupabase() {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function embedProposalAvatarDataUri(
  src: string | null | undefined,
  supabase: Awaited<ReturnType<typeof resolveExportAvatarSupabase>>
): Promise<string | null> {
  const trimmedSrc = src?.trim() || null;
  if (!trimmedSrc) return null;

  const cached = embedCache.get(trimmedSrc);
  if (cached !== undefined) return cached;

  let embedded: string | null = null;

  if (trimmedSrc.startsWith("data:")) {
    embedded = trimmedSrc;
  } else {
    const result = await fetchCreatorAvatarImage({ src: trimmedSrc, supabase });
    if (result.ok) {
      const buffer = Buffer.from(result.buffer);
      const contentType = result.contentType || detectImageContentType(buffer);
      embedded = toUnprocessedImageDataUri(buffer, contentType);
    } else {
      const fetched = await embedReportImageDataUri(trimmedSrc);
      if (fetched?.startsWith("data:")) {
        embedded = fetched;
      }
    }
  }

  embedCache.set(trimmedSrc, embedded);
  return embedded;
}

/** Embed client logo from the client master as a data URI for Puppeteer-safe PDF export. */
export async function embedProposalClientLogo(
  url: string | undefined
): Promise<string | undefined> {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;

  const embedded = await embedReportImageDataUri(trimmed);
  if (!embedded?.startsWith("data:")) return trimmed;
  return compressExportDataUri(embedded, CLIENT_LOGO_COMPRESS);
}

async function embedProposalVendor(
  vendor: ProposalVendor,
  supabase: Awaited<ReturnType<typeof resolveExportAvatarSupabase>>
): Promise<ProposalVendor> {
  const avatarUrl = resolveEmbeddedUrl(
    await embedProposalAvatarDataUri(vendor.avatarUrl, supabase)
  );
  return avatarUrl ? { ...vendor, avatarUrl } : { ...vendor, avatarUrl: undefined };
}

/** Inline remote images so proposal PDF export matches in-app HTML preview. */
export async function embedProposalExportAssets(input: {
  vendors: ProposalVendor[];
  clientLogoUrl?: string;
}): Promise<{ vendors: ProposalVendor[]; clientLogoUrl?: string }> {
  embedCache.clear();
  const supabase = await resolveExportAvatarSupabase();
  const [clientLogoUrl, vendors] = await Promise.all([
    embedProposalClientLogo(input.clientLogoUrl),
    Promise.all(input.vendors.map((vendor) => embedProposalVendor(vendor, supabase))),
  ]);
  return { vendors, clientLogoUrl };
}
