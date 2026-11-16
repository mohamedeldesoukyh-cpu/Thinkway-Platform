import { createHash } from "node:crypto";

export function currentVendorSigningToken(io: { status: string; is_superseded: boolean | null; approval_token_hash: string | null; approval_token_expires_at: string | null }, payloads: unknown[], now = Date.now()): string | null {
  if (io.is_superseded || io.status !== "sent" || !io.approval_token_hash) return null;
  if (io.approval_token_expires_at && !(Date.parse(io.approval_token_expires_at) > now)) return null;
  for (const payload of payloads) {
    try {
      const url = new URL(String((payload as { approval_url?: unknown })?.approval_url ?? ""));
      if (url.pathname !== "/io-approval/vendor") continue;
      const token = url.searchParams.get("signing_token") ?? url.searchParams.get("token");
      if (token && createHash("md5").update(token).digest("hex") === io.approval_token_hash) return token;
    } catch { /* Ignore legacy or malformed notification payloads. */ }
  }
  return null;
}
