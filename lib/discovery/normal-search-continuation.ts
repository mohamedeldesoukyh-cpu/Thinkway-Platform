import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import type { NormalSearchContinuation, NormalSearchRequest } from "./normal-search";
import { runNormalSearchTransport } from "./normal-search-transport";

const MAX_TOKEN = 750_000;
const TTL = 15 * 60_000;
const invalid = () => new Error("Discovery continuation is invalid or expired. Start a new search.");
function key(secret: string) {
  // Exactly 32 random bytes, encoded canonically as unpadded base64url.
  const decoded = Buffer.from(secret, "base64url");
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret) || decoded.length !== 32 || decoded.toString("base64url") !== secret) {
    throw new Error("Discovery continuation server secret is unavailable or invalid");
  }
  return createHash("sha256").update("discovery-continuation-v1\0" + secret).digest();
}
/** Server runtime configuration only. No fallback to other credentials or generated keys. */
export function readContinuationSecret(): string {
  const secret = process.env.DISCOVERY_CONTINUATION_SECRET ?? "";
  key(secret);
  return secret;
}
// Stable object ordering; array order is intentionally part of the request binding.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
function binding(request: NormalSearchRequest, context: string) {
  return Buffer.from(canonical({ context, filters: request.filters, sort: request.sort, pageSize: request.pageSize, page: request.page }));
}
export function encodeContinuation(state: NormalSearchContinuation, request: NormalSearchRequest, context: string, secret: string, now = Date.now()) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(binding({ ...request, page: request.page + 1 }, context));
  // Qualification is already sealed: joined caption evidence is no longer needed.
  const compact = { ...state, remaining: state.remaining.map(c => { const row = { ...c }; delete row.content_text; return row; }) };
  const body = deflateSync(Buffer.from(JSON.stringify({ version: 1, expires: now + TTL, state: compact })));
  const token = Buffer.concat([iv, cipher.update(body), cipher.final(), cipher.getAuthTag()]).toString("base64url");
  if (token.length > MAX_TOKEN) throw new Error("Discovery continuation exceeds safe size. Narrow the search.");
  return token;
}
export function decodeContinuation(token: string, request: NormalSearchRequest, context: string, secret: string, now = Date.now()): NormalSearchContinuation {
  try {
    if (token.length > MAX_TOKEN || !/^[A-Za-z0-9_-]+$/.test(token)) throw invalid();
    const bytes = Buffer.from(token, "base64url");
    if (bytes.length < 29 || bytes.toString("base64url") !== token) throw invalid();
    const decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(0,12));
    decipher.setAAD(binding(request, context));
    decipher.setAuthTag(bytes.subarray(-16));
    const body = Buffer.concat([decipher.update(bytes.subarray(12,-16)), decipher.final()]);
    const payload = JSON.parse(inflateSync(body, { maxOutputLength: 4_000_000 }).toString());
    if (payload.version !== 1 || !Number.isFinite(payload.expires) || payload.expires <= now) throw invalid();
    return payload.state;
  } catch { throw invalid(); }
}

/** Called only after fresh authentication. Recheck permission even for carried-only pages. */
export async function runContinuedNormalSearch(client: Parameters<typeof runNormalSearchTransport>[0], request: NormalSearchRequest, context: string, secret: string, ranking?: Parameters<typeof runNormalSearchTransport>[3]) {
  const discovery = await client.rpc("has_permission", { p_permission: "discovery.read" });
  if (discovery.error) throw new Error("Unauthorized");
  if (discovery.data !== true) {
    const influencers = await client.rpc("has_permission", { p_permission: "influencers.read" });
    if (influencers.error || influencers.data !== true) throw new Error("Unauthorized");
  }
  key(secret); // Fail closed even on page one if secure continuation is unavailable.
  if (request.page > 1 && !request.continuation) throw invalid();
  if (request.page === 1 && request.continuation) throw invalid();
  const state = request.continuation ? decodeContinuation(request.continuation, request, context, secret) : undefined;
  const { continuation, ...result } = await runNormalSearchTransport(client, request, state, ranking);
  return { ...result, continuation: continuation ? encodeContinuation(continuation, request, context, secret) : undefined };
}
