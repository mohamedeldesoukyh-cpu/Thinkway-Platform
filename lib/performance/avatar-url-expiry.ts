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

