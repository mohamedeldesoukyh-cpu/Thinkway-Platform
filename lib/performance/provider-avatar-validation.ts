import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  isAvatarUrlNeedsRefresh,
  isEmptyAvatarUrl,
  isPlaceholderAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";
import {
  prepareCreatorAvatarUrlForDisplay,
  stabilizeTikTokAvatarUrl,
} from "@/lib/performance/creator-avatar";

export const PROVIDER_AVATAR_MIN_BYTES = 2 * 1024;

export type ProviderAvatarValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type PersistableProviderAvatarResult =
  | { ok: true; url: string }
  | { ok: false; reason: string };

/** Injectable fetch for avatar probing (production `fetch` or test doubles). */
export type AvatarProbeFetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function isDataUriAvatarUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith("data:");
}

/** Detect expired CDN signed URLs (TikTok x-expires, generic expires/se). */
export function isExpiredSignedAvatarUrl(url: string, nowMs = Date.now()): boolean {
  try {
    const parsed = new URL(url.trim());
    const candidates = [
      parsed.searchParams.get("x-expires"),
      parsed.searchParams.get("expires"),
      parsed.searchParams.get("Expires"),
      parsed.searchParams.get("se"),
    ];

    for (const raw of candidates) {
      if (!raw?.trim()) continue;
      const numeric = Number(raw.trim());
      if (!Number.isFinite(numeric) || numeric <= 0) continue;
      const expiryMs = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      if (expiryMs < nowMs) return true;
    }
    const oe = parsed.searchParams.get("oe");
    if (oe && /^[0-9a-fA-F]+$/.test(oe)) {
      const expiryMs = parseInt(oe, 16) * 1000;
      if (Number.isFinite(expiryMs) && expiryMs <= nowMs) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/** Synchronous rejection heuristics — no network. */
export function rejectProviderAvatarUrlSync(
  url: string | null | undefined,
  nowMs = Date.now()
): ProviderAvatarValidationResult {
  if (url == null || isEmptyAvatarUrl(url)) {
    return { ok: false, reason: "empty" };
  }

  const trimmed = url.trim();

  if (isDataUriAvatarUrl(trimmed)) {
    return { ok: false, reason: "data_uri" };
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, reason: "not_http_url" };
  }

  if (isPlaceholderAvatarUrl(trimmed)) {
    return { ok: false, reason: "placeholder" };
  }

  if (isAvatarUrlNeedsRefresh(trimmed)) {
    return { ok: false, reason: "broken_or_placeholder" };
  }

  if (isExpiredSignedAvatarUrl(trimmed, nowMs)) {
    return { ok: false, reason: "expired_signed_url" };
  }

  return { ok: true };
}

async function probeAvatarResponseSize(
  url: string,
  fetchFn: AvatarProbeFetchFn,
): Promise<{ status: number; size: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const headResponse = await fetchFn(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    if (headResponse.ok) {
      const contentLength = Number(headResponse.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > 0) {
        return { status: headResponse.status, size: contentLength };
      }
    }

    // Instagram CDN often rejects HEAD — fall back to ranged GET.
    const rangeResponse = await fetchFn(url, {
      method: "GET",
      headers: { Range: "bytes=0-8191" },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!rangeResponse.ok && rangeResponse.status !== 206) {
      return { status: rangeResponse.status, size: null };
    }

    const buffer = await rangeResponse.arrayBuffer();
    const contentRange = rangeResponse.headers.get("content-range");
    if (contentRange) {
      const totalMatch = /\/(\d+)$/.exec(contentRange);
      if (totalMatch) {
        return { status: rangeResponse.status, size: Number(totalMatch[1]) };
      }
    }

    const rangedLength = Number(rangeResponse.headers.get("content-length") ?? "0");
    if (Number.isFinite(rangedLength) && rangedLength > 0) {
      return { status: rangeResponse.status, size: rangedLength };
    }

    return { status: rangeResponse.status, size: buffer.byteLength };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validate a provider avatar URL before persistence.
 * Rejects empty/null, placeholders, data URIs, expired signed URLs,
 * non-200 responses, and images smaller than 2 KB.
 */
export async function validateProviderAvatarUrl(
  url: string | null | undefined,
  options?: {
    nowMs?: number;
    minBytes?: number;
    fetchFn?: AvatarProbeFetchFn;
    skipNetwork?: boolean;
  }
): Promise<ProviderAvatarValidationResult> {
  const sync = rejectProviderAvatarUrlSync(url, options?.nowMs);
  if (!sync.ok) return sync;

  if (options?.skipNetwork) return { ok: true };

  const trimmed = url!.trim();
  const minBytes = options?.minBytes ?? PROVIDER_AVATAR_MIN_BYTES;
  const fetchFn = options?.fetchFn ?? fetch;

  try {
    const probe = await probeAvatarResponseSize(trimmed, fetchFn);
    if (probe.status !== 200 && probe.status !== 206) {
      return { ok: false, reason: `http_${probe.status}` };
    }
    if (probe.size != null && probe.size < minBytes) {
      return { ok: false, reason: "image_too_small" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
}

type ProviderAvatarResolveOptions = {
  nowMs?: number;
  minBytes?: number;
  fetchFn?: AvatarProbeFetchFn;
  skipNetwork?: boolean;
};

/**
 * Resolve a provider avatar URL safe to persist.
 * TikTok: prefer unsigned CDN paths after a signed URL passes probe; when signed
 * URLs are expired or blocked, retry stabilized variants before rejecting.
 */
export async function resolvePersistableProviderAvatarUrl(
  platform: string,
  url: string,
  options?: ProviderAvatarResolveOptions
): Promise<PersistableProviderAvatarResult> {
  const trimmed = url.trim();
  const platformKey = canonicalPlatformKey(platform);

  const original = await validateProviderAvatarUrl(trimmed, options);
  if (original.ok) {
    const normalized = prepareCreatorAvatarUrlForDisplay(platformKey, trimmed) ?? trimmed;
    if (normalized === trimmed) {
      return { ok: true, url: trimmed };
    }
    const normalizedValidation = await validateProviderAvatarUrl(normalized, options);
    if (normalizedValidation.ok) {
      return { ok: true, url: normalized };
    }
    return { ok: true, url: trimmed };
  }

  if (platformKey !== "tiktok") {
    return original;
  }

  const variants = new Set<string>();
  variants.add(stabilizeTikTokAvatarUrl(trimmed));
  const normalized = prepareCreatorAvatarUrlForDisplay(platformKey, trimmed) ?? trimmed;
  variants.add(normalized);
  variants.add(stabilizeTikTokAvatarUrl(normalized));

  for (const variant of variants) {
    if (!variant || variant === trimmed) continue;
    const validation = await validateProviderAvatarUrl(variant, options);
    if (validation.ok) {
      return { ok: true, url: variant };
    }
  }

  return original;
}
