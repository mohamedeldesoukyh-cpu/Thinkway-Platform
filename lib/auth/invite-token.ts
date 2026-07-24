import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Hash invite tokens for storage. Prefer HMAC-SHA256 when INVITE_TOKEN_SECRET
 * is set; otherwise SHA-256 of the raw token (still never store plaintext).
 */
export function hashInviteToken(rawToken: string): string {
  const normalized = rawToken.trim();
  if (!normalized) {
    throw new Error("Invite token is empty.");
  }

  const secret = process.env.INVITE_TOKEN_SECRET?.trim();
  if (secret) {
    return createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
  }

  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time compare of hex digests. */
export function inviteTokenHashesEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length === 0 || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
