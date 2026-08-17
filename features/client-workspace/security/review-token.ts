import { createHash, timingSafeEqual } from "node:crypto";

/** Same digest as `hash_io_approval_token` (md5 of the raw token). */
export function hashClientReviewToken(rawToken: string): string {
  const normalized = rawToken.trim();
  if (!normalized) throw new Error("Review token is empty.");
  return createHash("md5").update(normalized, "utf8").digest("hex");
}

export function clientReviewTokenHashesEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length === 0 || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function parseReviewCookie(value: string | undefined | null): {
  reviewId: string;
  token: string;
} | null {
  if (!value?.includes(":")) return null;
  const idx = value.indexOf(":");
  const reviewId = value.slice(0, idx).trim();
  const token = value.slice(idx + 1).trim();
  if (!reviewId || token.length < 16) return null;
  return { reviewId, token };
}

export function buildReviewCookieValue(reviewId: string, token: string): string {
  return `${reviewId}:${token.trim()}`;
}

export function buildClientReviewPath(reviewId: string, token: string, section?: string): string {
  const base = section ? `/review/${reviewId}/${section}` : `/review/${reviewId}`;
  const params = new URLSearchParams({ sign: token });
  return `${base}?${params.toString()}`;
}
