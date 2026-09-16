import { DatasetValidationError } from "./apify-preflight-scan";
/** Pure planning and GET-only storage access. No database writer dependencies. */
import { mergeCreatorRecentPublications, canonicalPublicationUrl } from "./publication-evidence";
import type { CreatorRecentPublication } from "./types";
import { mergeCandidatesIntoDocument } from "@/features/creator-dna/services/dna-merge-engine";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import type { CreatorDNADocument } from "@/features/creator-dna/types";
import { getPreflightJson, type ReadOptions } from "./preflight-get";

export const TARGETS = { development: "hsxrewjcbvmbkqdlzjhs", production: "ienowhwfyxoqtzbgltno" } as const;
export type Account = {
  id: string; influencer_id: string; platform: string | null;
  handle?: string | null; username?: string | null; normalized_username?: string | null;
  stableIds: string[]; recent_publications: unknown; field_sources?: unknown;
};
export type DnaRow = { influencer_id: string; document: CreatorDNADocument; [key: string]: unknown };
export type Evidence = { ownerId: string | null; username: string | null; publication: CreatorRecentPublication; capturedAt: string };
export function stableId(value: unknown): string | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9._]+$/.test(name) ? name : null;
}
export function matchAccount(accounts: Account[], ownerId: string | null, username: string | null):
  { kind: "matched"; account: Account; via: "stableId" | "username" } |
  { kind: "unmatched" | "ambiguous" | "conflict" } {
  const candidates = accounts.filter(a => a.platform?.toLowerCase() === "instagram");
  const name = normalizeUsername(username);
  const names = name ? candidates.filter(a => [a.handle, a.username, a.normalized_username].some(v => normalizeUsername(v) === name)) : [];
  const ids = ownerId ? candidates.filter(a => a.stableIds.includes(ownerId)) : [];
  if (ids.length > 1) return { kind: "ambiguous" };
  if (ids.length === 1) {
    const account = ids[0]!;
    if (account.stableIds.length > 1 || names.some(a => a.id !== account.id)) return { kind: "conflict" };
    return { kind: "matched", account, via: "stableId" };
  }
  if (names.length > 1) return { kind: "ambiguous" };
  if (names.length === 0) return { kind: "unmatched" };
  const account = names[0]!;
  if (account.stableIds.length > 1 || (ownerId && account.stableIds.length && !account.stableIds.includes(ownerId))) return { kind: "conflict" };
  return { kind: "matched", account, via: "username" };
}

export function semanticJson(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(semanticJson).join(",")}]`;
  return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${semanticJson(v)}`).join(",")}}`;
}
const same = (a: unknown, b: unknown) => semanticJson(a) === semanticJson(b);
const list = (value: unknown): CreatorRecentPublication[] => Array.isArray(value) ? value : [];
function postKey(p: CreatorRecentPublication): string | null {
  return p.platformPostId ? `id:${p.platformPostId}` : canonicalPublicationUrl(p.url);
}
function changedPosts(before: CreatorRecentPublication[], after: CreatorRecentPublication[]) {
  return after.filter(p => {
    const old = before.find(b => (p.platformPostId && b.platformPostId === p.platformPostId) || (canonicalPublicationUrl(p.url) && canonicalPublicationUrl(p.url) === canonicalPublicationUrl(b.url)));
    return !old || !same(old, p);
  });
}
export function planPublicationBackfill(accounts: Account[], dnaRows: DnaRow[], evidence: Evidence[]) {
  const skipped: { reason: string; ownerId: string | null; username: string | null }[] = [];
  const incoming = new Map<string, Evidence[]>();
  // A reused username with multiple historical owners must not authorize a
  // fallback for an account whose stable identity is unknown.
  const owners = new Map<string, Set<string>>();
  for (const e of evidence) {
    const name = normalizeUsername(e.username);
    if (name && e.ownerId) owners.set(name, new Set([...(owners.get(name) ?? []), e.ownerId]));
  }
  for (const e of evidence) {
    const match = matchAccount(accounts, e.ownerId, e.username);
    const reason = match.kind !== "matched" ? match.kind :
      match.via === "username" && (owners.get(normalizeUsername(e.username) ?? "")?.size ?? 0) > 1 ? "conflict" : null;
    if (reason || match.kind !== "matched") { skipped.push({ reason: reason!, ownerId: e.ownerId, username: e.username }); continue; }
    incoming.set(match.account.id, [...(incoming.get(match.account.id) ?? []), e]);
  }
  const accountPlans: { id: string; influencerId: string; changed: boolean; publications: CreatorRecentPublication[] }[] = [];
  const dnaPlans: { influencerId: string; changed: boolean; creates: boolean; document: CreatorDNADocument }[] = [];
  const byCreator = new Map<string, Evidence[]>();
  const enriched = new Set<string>();
  const matched = new Set<string>();
  const identityIssues: { scope: string; kind: string; key: string | null }[] = [];
  const urlIds = new Map<string, Set<string>>();
  const indexPost = (creator: string, p: CreatorRecentPublication) => {
    const url = canonicalPublicationUrl(p.url);
    if (url && p.platformPostId) {
      const key = `${creator}:${url}`;
      urlIds.set(key, new Set([...(urlIds.get(key) ?? []), p.platformPostId]));
    }
  };
  for (const a of accounts) {
    for (const p of list(a.recent_publications)) indexPost(a.influencer_id, p);
    for (const e of incoming.get(a.id) ?? []) indexPost(a.influencer_id, e.publication);
  }
  for (const row of dnaRows) for (const p of list(row.document.content.recentPublications.value)) indexPost(row.influencer_id, p);
  const countKey = (creator: string, key: string | null) => {
    const ids = urlIds.get(`${creator}:${key}`);
    return `${creator}:${ids?.size === 1 ? `id:${[...ids][0]}` : key}`;
  };
  for (const account of accounts) {
    const rows = incoming.get(account.id);
    if (!rows) continue;
    // Deterministic newest-first fill for missing values, independent of fetch timing.
    rows.sort((a,b) => b.capturedAt.localeCompare(a.capturedAt) || semanticJson(a).localeCompare(semanticJson(b)));
    const before = list(account.recent_publications);
    const publications = mergeCreatorRecentPublications(before, rows.map(e => e.publication), issue => identityIssues.push({ scope: account.id, kind: issue.kind, key: postKey(issue.publication) }));
    accountPlans.push({ id: account.id, influencerId: account.influencer_id, changed: !same(before, publications), publications });
    byCreator.set(account.influencer_id, [...(byCreator.get(account.influencer_id) ?? []), ...rows]);
    for (const e of rows) matched.add(countKey(account.influencer_id, postKey(e.publication)));
    for (const p of changedPosts(before, publications)) enriched.add(countKey(account.influencer_id, postKey(p)));
  }
  for (const [influencerId, rows] of byCreator) {
    const found = dnaRows.filter(r => r.influencer_id === influencerId);
    if (found.length > 1) throw new Error(`Duplicate DNA rows for ${influencerId}`);
    const existing = found[0]?.document;
    const document = structuredClone(existing ?? createEmptyCreatorDNADocument());
    const before = list(document.content.recentPublications.value);
    const publications = mergeCreatorRecentPublications(before, rows.map(e => e.publication), issue => identityIssues.push({ scope: influencerId, kind: issue.kind, key: postKey(issue.publication) }));
    if (!same(before, publications)) mergeCandidatesIntoDocument(document, [{
      path: "content.recentPublications", value: publications, confidence: 0.7, source: "ipl",
      sourceVersion: "apify-historical-publication-evidence-v1", updatedAt: rows.map(e => e.capturedAt).sort().at(-1)!,
    }]);
    const after = document.content.recentPublications.value;
    const changed = !same(before, after);
    dnaPlans.push({ influencerId, changed, creates: !existing && changed, document });
    for (const p of changedPosts(before, after)) enriched.add(countKey(influencerId, postKey(p)));
  }
  const issues = [...new Map(identityIssues.map(i => [semanticJson(i), i])).values()];
  const rejected = new Set(issues.map(i => countKey(accounts.find(a => a.id === i.scope)?.influencer_id ?? i.scope, i.key)));
  return {
    summary: {
      accountsMatched: accountPlans.length, creatorsMatched: byCreator.size,
      accountsChanged: accountPlans.filter(p => p.changed).length,
      dnaDocumentsChanged: dnaPlans.filter(p => p.changed).length,
      publicationsEnriched: enriched.size,
      unchanged: { accounts: accountPlans.filter(p => !p.changed).length, dnaDocuments: dnaPlans.filter(p => !p.changed).length, publications: [...matched].filter(k => !enriched.has(k) && !rejected.has(k)).length },
      skipped: skipped.length, skippedPublicationProposals: issues.length,
      ambiguous: skipped.filter(s => s.reason === "ambiguous").length + issues.filter(i => i.kind === "ambiguous").length,
      conflicts: skipped.filter(s => s.reason === "conflict").length + issues.filter(i => i.kind === "conflict").length,
      actualWrites: 0,
    }, accountPlans, dnaPlans, skipped, identityIssues: issues,
  };
}

/** Explicit totals prevent silent truncation on a short/empty intermediate page. */
export async function readAllPages<T>(read: (offset: number, limit: number) => Promise<{ items: T[]; total: number }>, size = 1000): Promise<T[]> {
  if (!Number.isInteger(size) || size <= 0) throw new Error("Invalid page size");
  const output: T[] = [];
  let expected: number | undefined;
  do {
    const page = await read(output.length, size);
    if (!Number.isSafeInteger(page.total) || page.total < 0 || (expected != null && page.total !== expected)) throw new Error("Storage changed during pagination; repeat preflight");
    expected = page.total;
    if (page.items.length === 0 && output.length < expected) throw new Error("Incomplete storage page");
    output.push(...page.items);
    if (output.length > expected) throw new Error("Inconsistent storage count");
  } while (output.length < expected);
  return output;
}

export function createReadOnlyStorage(target: keyof typeof TARGETS, supabaseUrl: string, credential: string, apifyToken: string, transport: typeof fetch = fetch, options: ReadOptions = {}) {
  if (!Object.hasOwn(TARGETS, target) || supabaseUrl !== `https://${TARGETS[target]}.supabase.co`) throw new Error("Explicit target does not match Supabase URL");
  // Anonymous and ordinary user JWTs can silently return RLS-filtered emptiness.
  // Only a server-validated administrative read credential is accepted here.
  let role: string | undefined;
  try { role = JSON.parse(Buffer.from(credential.split('.')[1] ?? '', 'base64url').toString()).role; } catch { /* opaque secret */ }
  if (!credential.startsWith("sb_secret_") && role !== "service_role") throw new Error("Authenticated unrestricted read credential required; anon/user access refused");
  async function get(url: string, headers: Record<string, string>) {
    return getPreflightJson(transport, url, headers, options);
  }
  async function apifyRead(path: string) {
    // Explicit endpoint/query allowlists; no run-launch or other action endpoints.
    const [pathname, query = ""] = path.split("?");
    const allowed = /^acts\/[\w~-]+$/.test(pathname!) ? [] :
      /^actors\/[\w~-]+\/runs$/.test(pathname!) ? ["offset", "limit", "desc", "status", "startedBefore"] :
      pathname === "actor-runs" ? ["offset", "limit", "desc"] :
      /^datasets\/[\w-]+$/.test(pathname!) ? [] :
      /^datasets\/[\w-]+\/items$/.test(pathname!) ? ["format", "offset", "limit", "clean", "desc"] : null;
    if (!apifyToken || !allowed || /[#\\]/.test(path) || path.split("?").length > 2 ||
        [...new URLSearchParams(query).keys()].some(key => !allowed.includes(key))) throw new Error("Apify storage path not allowed");
    return get(`https://api.apify.com/v2/${path}`, { Authorization: `Bearer ${apifyToken}` });
  }
  return {
    async table<T>(table: "influencer_platform_accounts" | "creator_dna" | "ipl_snapshots", query: string): Promise<T[]> {
      if (!["influencer_platform_accounts", "creator_dna", "ipl_snapshots"].includes(table) || !query.startsWith("select=")) throw new Error("Read table not allowed");
      return readAllPages(async (offset, limit) => {
        const response = await get(`${supabaseUrl}/rest/v1/${table}?${query}&offset=${offset}&limit=${limit}`, { apikey: credential, ...(credential.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${credential}` }), Prefer: "count=exact" });
        const range = response.headers.get("content-range");
        const count = range?.match(/\/(\d+)$/)?.[1];
        if (count == null) throw new Error("Unverifiable authenticated read count");
        const items = response.data;
        if (!Array.isArray(items)) throw new Error("Invalid table response");
        return { items: items as T[], total: Number(count) };
      });
    },
    async apify<T>(path: string): Promise<T> {
      return (await apifyRead(path)).data as T;
    },
    async datasetPage(id: string, offset: number, limit: number) {
      if (![offset, limit].every(Number.isSafeInteger) || offset < 0 || limit < 1) throw new Error("Invalid dataset pagination");
      const response = await apifyRead(`datasets/${id}/items?format=json&offset=${offset}&limit=${limit}&clean=false&desc=0`);
      const count = response.headers.get("x-apify-pagination-total");
      const start = response.headers.get("x-apify-pagination-offset");
      const items = response.data;
      if (!count || !/^\d+$/.test(count) || !Number.isSafeInteger(Number(count)) ||
          start === null || !/^\d+$/.test(start) || Number(start) !== offset || !Array.isArray(items) || items.length > limit) {
        throw new DatasetValidationError("Unverifiable dataset page");
      }
      return { items, total: Number(count) };
    },
  };
}
