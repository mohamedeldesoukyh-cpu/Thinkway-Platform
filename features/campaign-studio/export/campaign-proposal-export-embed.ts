/**
 * Embed client logo and creator avatars as data URIs for proposal PDF export.
 * Headless Chromium cannot load Supabase or social CDN URLs; preview keeps remote URLs.
 */
import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import {
  compressExportDataUri,
  toCompressedExportDataUri,
  type CompressExportImageOptions,
} from "@/lib/io/compress-export-image";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";

import type { ProposalVendor } from "./campaign-proposal-document";

const PROPOSAL_AVATAR_COMPRESS: CompressExportImageOptions = {
  maxEdge: 64,
  quality: 75,
};

const CLIENT_LOGO_COMPRESS: CompressExportImageOptions = {
  maxEdge: 240,
  quality: 80,
};

const embedCache = new Map<string, string | null>();

function resolveEmbeddedUrl(embedded: string | null): string | undefined {
  return embedded?.startsWith("data:") ? embedded : undefined;
}

async function embedProposalAvatarDataUri(
  src: string | null | undefined
): Promise<string | null> {
  const trimmedSrc = src?.trim() || null;
  if (!trimmedSrc) return null;

  const cached = embedCache.get(trimmedSrc);
  if (cached !== undefined) return cached;

  let embedded: string | null = null;

  if (trimmedSrc.startsWith("data:")) {
    embedded = await compressExportDataUri(trimmedSrc, PROPOSAL_AVATAR_COMPRESS);
  } else {
    const result = await fetchCreatorAvatarImage({ src: trimmedSrc });
    if (result.ok) {
      const buffer = Buffer.from(result.buffer);
      const contentType = result.contentType || detectImageContentType(buffer);
      embedded = await toCompressedExportDataUri(
        buffer,
        contentType,
        PROPOSAL_AVATAR_COMPRESS
      );
    } else {
      const fetched = await embedReportImageDataUri(trimmedSrc);
      if (fetched?.startsWith("data:")) {
        embedded = await compressExportDataUri(fetched, PROPOSAL_AVATAR_COMPRESS);
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

async function embedProposalVendor(vendor: ProposalVendor): Promise<ProposalVendor> {
  const avatarUrl = resolveEmbeddedUrl(
    await embedProposalAvatarDataUri(vendor.avatarUrl)
  );
  return avatarUrl ? { ...vendor, avatarUrl } : { ...vendor, avatarUrl: undefined };
}

/** Inline remote images so proposal PDF export matches in-app HTML preview. */
export async function embedProposalExportAssets(input: {
  vendors: ProposalVendor[];
  clientLogoUrl?: string;
}): Promise<{ vendors: ProposalVendor[]; clientLogoUrl?: string }> {
  embedCache.clear();
  const [clientLogoUrl, vendors] = await Promise.all([
    embedProposalClientLogo(input.clientLogoUrl),
    Promise.all(input.vendors.map((vendor) => embedProposalVendor(vendor))),
  ]);
  return { vendors, clientLogoUrl };
}
