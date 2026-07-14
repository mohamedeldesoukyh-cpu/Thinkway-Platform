/**
 * Discovery pipeline diagnostic — read-only end-to-end trace for a Campaign Plan.
 *
 *   npx tsx scripts/trace-discovery.ts <conversationId> [--query="..."]
 *   npm run trace:discovery -- <conversationId>
 *
 * Loads the campaign object for a conversation, reconstructs the Studio search
 * filters from its facts (reusing the REAL filter builder), runs the actual
 * Discovery browse (reusing the REAL browse + coverage/backfill pipeline), and
 * prints the full funnel with the FIRST LOSS POINT. It also prints the persisted
 * ground truth (latest discovery_coverage_decisions row) and the stored
 * campaign-object slate state, so a fresh run and the real Studio run can be
 * compared.
 *
 * READ-ONLY: no mutations, no fixes, no business-logic changes. It only reads and
 * reuses existing functions. Requires NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY in .env (same as other scripts).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- diagnostic script: untyped service client + defensive reads */
import "./trace-discovery-enable";

import { createClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  loadCampaignObjectForConversation,
  getCampaignObjectFromSnapshot,
  deserializeCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { getCampaignFacts, buildCreatorMixFromFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { searchCreatorsInputToBrowseFilters } from "@/features/ai/tools/search-creators-browse";
import type { SearchCreatorsInput } from "@/features/ai/tools/schemas";
import { buildCampaignSearchIntent } from "@/features/ai/tools/campaign-search-intent";
import { proposeInitialCreatorSlateWithStatus } from "@/features/campaign-studio/services/propose-creator-slate";
import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { resolveBrowseCategories } from "@/lib/creators/category-filter";

// Environment is loaded by scripts/run-ops-script.mjs (single env-loading path).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey?.startsWith("eyJ")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or valid SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

// --- helpers -----------------------------------------------------------------

const line = (label: string, value: unknown) =>
  console.log(`  ${label.padEnd(22)} ${format(value)}`);
const header = (title: string) => console.log(`\n${"─".repeat(64)}\n${title}\n${"─".repeat(64)}`);
const arrow = () => console.log("        ↓");

function format(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "(none)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function argFlag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

/**
 * Race a query against a timeout so a hung connection fails LOUDLY with the
 * exact step, instead of leaving the diagnostic silent after the banner.
 */
function withTimeout<T>(label: string, promise: PromiseLike<T>, ms = 25000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`__timeout__ query timed out after ${ms}ms at: ${label}`)),
      ms
    );
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    timeout,
  ]);
}

// --- Supabase error classification & timed query executor --------------------

/**
 * Detect a transport-layer failure (DNS / TLS / network / fetch) from a text
 * blob assembled out of an error's message/details/code/cause. Returns a
 * classification string, or null when it is not a transport failure. Shared by
 * both the "thrown" and "returned error object" paths — supabase-js reports
 * fetch failures both ways depending on the version.
 */
function classifyTransportSignature(blob: string): string | null {
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(blob))
    return "DNS failure — host not resolvable (check NEXT_PUBLIC_SUPABASE_URL)";
  if (/CERT|certificate|self.signed|unable to get local issuer|ERR_TLS|DEPTH_ZERO|SELF_SIGNED/i.test(blob))
    return "TLS / certificate failure — run with --use-system-ca (corporate SSL inspection)";
  if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|EHOSTUNREACH|ENETUNREACH/i.test(blob))
    return "Network/connect failure — often broken IPv6; run with --dns-result-order=ipv4first";
  if (/fetch failed/i.test(blob)) return "Network failure at transport layer (fetch failed)";
  return null;
}

/** Classify an error THROWN by the transport layer (undici/fetch/TLS/DNS). */
function classifyThrownError(err: any): string {
  const msg = String(err?.message ?? err ?? "");
  const cause = err?.cause;
  const blob = `${String(cause?.code ?? err?.code ?? "")} ${String(cause?.message ?? "")} ${msg}`;
  if (/__timeout__|timed out/i.test(msg)) return "Timeout (no response before deadline)";
  if (/invalid url|ERR_INVALID_URL/i.test(blob)) return "Invalid project URL (NEXT_PUBLIC_SUPABASE_URL is malformed)";
  return classifyTransportSignature(blob) ?? `Unknown transport error: ${msg}`;
}

/** Classify a PostgREST error object returned in { data, error }. */
function classifySupabaseError(error: any): string {
  const code = String(error?.code ?? "");
  const status = error?.status ?? error?.statusCode;
  const msg = String(error?.message ?? "");
  // supabase-js often RETURNS transport failures as an error object (not thrown).
  const transport = classifyTransportSignature(`${code} ${msg} ${String(error?.details ?? "")}`);
  if (transport) return transport;
  if (code === "PGRST116") return "Query succeeded but returned zero rows";
  if (code === "42P01") return "Table not found";
  if (code === "42501") return "Authorization / RLS denied";
  if (status === 401 || /jwt|invalid api key|invalid signature|invalid.*token|no api key/i.test(msg))
    return "Authentication failure — invalid/expired service role (JWT)";
  if (status === 403) return "Authorization / RLS denied";
  if (typeof status === "number") return `HTTP error (status ${status})`;
  return "Query error (see full error below)";
}

/** Print the COMPLETE error object — never swallow it. */
function printFullError(error: any) {
  const fields = ["message", "code", "status", "statusCode", "details", "hint", "name"] as const;
  for (const f of fields) {
    if (error?.[f] != null) console.log(`      ${f}: ${error[f]}`);
  }
  if (error?.cause) {
    console.log(`      cause.code: ${error.cause?.code ?? "—"}`);
    console.log(`      cause.message: ${error.cause?.message ?? error.cause}`);
    if (error.cause?.cause) console.log(`      cause.cause: ${error.cause.cause?.code ?? error.cause.cause?.message ?? error.cause.cause}`);
  }
  try {
    const raw = JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));
    if (raw && raw !== "{}") console.log(`      raw: ${raw}`);
  } catch {
    /* non-serializable — the fields above already cover it */
  }
}

type QueryOutcome<T> = { data: T | null; error: any | null; classification: string | null; ms: number };

/**
 * Execute a Supabase query with timing + error classification. Prints
 * START / END / FAILED with elapsed ms, and NEVER converts a transport failure
 * into a "no row" result — a thrown fetch error is surfaced as such.
 */
async function runQuery<T = any>(
  label: string,
  builder: PromiseLike<{ data: T | null; error: any }>
): Promise<QueryOutcome<T>> {
  const start = Date.now();
  console.log(`  START query: ${label}`);
  try {
    const res: any = await withTimeout(label, builder);
    const ms = Date.now() - start;
    if (res?.error) {
      const classification = classifySupabaseError(res.error);
      console.log(`  FAILED query: ${label} (${ms} ms)`);
      console.log(`      Reason: ${classification}`);
      printFullError(res.error);
      return { data: null, error: res.error, classification, ms };
    }
    const rows = Array.isArray(res?.data) ? `${res.data.length} rows` : res?.data ? "1 row" : "0 rows";
    console.log(`  END query: ${label} (${ms} ms) → ${rows}`);
    return { data: (res?.data ?? null) as T | null, error: null, classification: null, ms };
  } catch (err: any) {
    const ms = Date.now() - start;
    const classification = classifyThrownError(err);
    console.log(`  FAILED query: ${label} (${ms} ms)`);
    console.log(`      Reason: ${classification}`);
    printFullError(err);
    return { data: null, error: err, classification, ms };
  }
}

/** Mask a secret for safe printing: keep a short prefix + length. */
function mask(secret: string | undefined): string {
  if (!secret) return "MISSING";
  return `${secret.slice(0, 6)}…(${secret.length} chars)`;
}

/** Print connection diagnostics BEFORE the first query. */
function printConnectionDiagnostics() {
  header("CONNECTION DIAGNOSTICS");
  let host = "—";
  let projectRef = "—";
  try {
    const u = new URL(url ?? "");
    host = u.host;
    projectRef = u.host.split(".")[0] ?? "—";
  } catch {
    host = `INVALID URL: ${url ?? "(empty)"}`;
  }
  line("client impl", "@supabase/supabase-js createClient (service role)");
  line("node version", process.version);
  const nodeOpts = process.env.NODE_OPTIONS ?? "";
  const execArgv = process.execArgv.join(" ");
  const flags = `${nodeOpts} ${execArgv}`;
  line("--use-system-ca", /--use-system-ca/.test(flags) ? "active" : "NOT active");
  line("--dns-result-order", /--dns-result-order=ipv4first/.test(flags) ? "ipv4first" : "default (may prefer IPv6)");
  line("supabase host", host);
  line("project ref", projectRef);
  line("service role key", mask(serviceKey));
  line("HTTPS_PROXY", process.env.HTTPS_PROXY ?? process.env.https_proxy ?? "(none)");
  if (!/--use-system-ca/.test(flags) || !/--dns-result-order=ipv4first/.test(flags)) {
    console.log("  ⚠ TLS/DNS flags are not both active. On a corporate network this causes");
    console.log("    \"TypeError: fetch failed\". Run via `npm run trace:discovery -- <id>` (the runner");
    console.log("    applies --use-system-ca and --dns-result-order=ipv4first, matching the dev server).");
  }
}

/** Compact list of an object's top-level keys (for snapshot/metadata probes). */
function keysOf(value: unknown): string {
  if (!value || typeof value !== "object") return "—";
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length ? keys.join(", ") : "(empty object)";
}

/** First captured funnel stage that dropped a non-empty pool to zero. */
function firstZeroDrop(events: DropEvent[]): DropEvent | undefined {
  return events.find((d) => d.before > 0 && d.after === 0);
}

/** Print a "previous → current" diff row, flagging changes. */
function diff(label: string, prev: unknown, curr: unknown) {
  const p = format(prev);
  const c = format(curr);
  const changed = p !== c;
  const flag = changed ? "  ⟵ CHANGED" : "";
  console.log(`  ${label.padEnd(20)} ${p.slice(0, 40).padEnd(40)} → ${c.slice(0, 40)}${flag}`);
}

/** Reconstruct the Discovery query from facts (mirrors the Studio search input). */
function reconstructQuery(facts: CampaignFacts | undefined, override?: string): string {
  return (
    override ??
    facts?.rawBriefExcerpt ??
    [facts?.brandName, facts?.objective, facts?.audience, facts?.geography?.join(" "), facts?.platforms?.join(" ")]
      .filter(Boolean)
      .join(". ")
  );
}

/** Human-readable creator-mix summary derived from facts (deterministic). */
function creatorMixSummary(facts: CampaignFacts | undefined): string {
  if (!facts) return "—";
  try {
    const mix = buildCreatorMixFromFacts(facts);
    return mix.length ? mix.map((t) => `${t.percent}% ${t.tier}`).join(", ") : "(none)";
  } catch {
    return "(unavailable)";
  }
}

/** Whether the strategy section carries authored content. */
function strategyState(campaignObject: Pick<CampaignObject, "sections">): string {
  const content = campaignObject.sections?.strategy?.content;
  return typeof content === "string" && content.trim() ? `present (${content.trim().length} chars)` : "empty";
}

/** Pull the slate funnel numbers stored on a campaign-object snapshot. */
function slateFunnel(campaignObject: Pick<CampaignObject, "sections">): {
  discovery: number;
  recommendations: number;
  selected: number;
} {
  const data = (campaignObject.sections?.creators?.data ?? {}) as Record<string, any>;
  const discovery = data?.discovery?.creatorIds?.length ?? 0;
  const recommendations = data?.recommendations?.creatorIds?.length ?? 0;
  const decisions = data?.vendorDecisions;
  let selected = recommendations;
  if (Array.isArray(decisions)) {
    const chosen = decisions.filter((d: any) => {
      const v = (d?.decision ?? d?.status ?? "").toString().toLowerCase();
      return v === "selected" || v === "accepted" || v === "approved" || d?.selected === true;
    });
    if (chosen.length > 0) selected = chosen.length;
  } else if (decisions && typeof decisions === "object") {
    const chosen = Object.values(decisions).filter((d: any) => {
      const v = (d?.decision ?? d?.status ?? d ?? "").toString().toLowerCase();
      return v === "selected" || v === "accepted" || v === "approved" || d?.selected === true;
    });
    if (chosen.length > 0) selected = chosen.length;
  }
  return { discovery, recommendations, selected };
}

/**
 * Walk the version history (newest → oldest, skipping the current version) and
 * return the most recent snapshot whose recommendations.creatorIds is non-empty.
 * Read-only: loads snapshots only, never writes. Capped to a sane lookback.
 */
async function loadLastSuccessfulVersion(
  campaignObjectId: string,
  currentVersion: number | undefined
): Promise<{ version: number; campaignObject: CampaignObject } | null> {
  let versions: Array<{ version: number }> = [];
  try {
    versions = await CampaignObjectPersistenceService.listVersions(supabase, campaignObjectId);
  } catch {
    return null;
  }
  const sorted = versions.map((v) => v.version).sort((a, b) => b - a);
  // When the current version is unknown, treat the newest snapshot as current.
  const cutoff = currentVersion ?? sorted[0];
  const candidates = sorted.filter((v) => v < cutoff).slice(0, 25);

  for (const version of candidates) {
    try {
      const loaded = await CampaignObjectPersistenceService.loadVersion(supabase, campaignObjectId, version);
      const co = loaded?.campaignObject;
      if (!co) continue;
      const recs = ((co.sections?.creators?.data ?? {}) as Record<string, any>)?.recommendations?.creatorIds ?? [];
      if (recs.length > 0) return { version, campaignObject: co };
    } catch {
      // skip unreadable snapshot
    }
  }
  return null;
}

// --- Campaign Object resolution — reproduce the EXACT Studio load path --------

type CampaignObjectResolution = {
  campaignObject: CampaignObject | null;
  source: "db_persistence" | "context_snapshot" | "message_metadata" | "not_found";
  probe: {
    conversationExists: boolean;
    workspaceType?: string;
    workspaceId?: string;
    dbVersion: number | null;
    snapshotHasObject: boolean;
    messageMetadataHasObject: boolean;
    studioMessageCount: number;
  };
};

/**
 * Resolve the Campaign Object the way the Studio does. The chat route and studio
 * hydration both call:
 *   loadCampaignObjectForConversation(supabase, conversationId, conversation.contextSnapshot)
 * where contextSnapshot comes from ai_conversations.context_snapshot. That
 * function tries the DB persistence table first, then falls back to the
 * snapshot. The Studio ALSO carries the object in the latest studio message's
 * metadata (backward-compat mirror), so we probe that as a final source.
 *
 * The original diagnostic omitted contextSnapshot entirely, so it only ever saw
 * the DB persistence table — hence "No campaign object found" for conversations
 * whose object lives only in the conversation snapshot or message metadata.
 * Read-only: this only SELECTs.
 */
async function resolveCampaignObjectLikeStudio(
  conversationId: string
): Promise<CampaignObjectResolution> {
  const probe: CampaignObjectResolution["probe"] = {
    conversationExists: false,
    dbVersion: null,
    snapshotHasObject: false,
    messageMetadataHasObject: false,
    studioMessageCount: 0,
  };

  // 1) The conversation row → context_snapshot (service role bypasses RLS, so we
  //    query by id without the created_by filter getConversation() uses).
  let contextSnapshot: Record<string, unknown> | undefined;
  const { data: convo } = await runQuery<any>(
    "ai_conversations (context_snapshot)",
    supabase
      .from("ai_conversations")
      .select("id, workspace_type, workspace_id, context_snapshot")
      .eq("id", conversationId)
      .maybeSingle()
  );
  if (convo) {
    probe.conversationExists = true;
    probe.workspaceType = convo.workspace_type ?? undefined;
    probe.workspaceId = convo.workspace_id ?? undefined;
    contextSnapshot = (convo.context_snapshot ?? {}) as Record<string, unknown>;
    probe.snapshotHasObject = getCampaignObjectFromSnapshot(contextSnapshot) != null;
  }

  // 2) Record what the DB persistence table holds (for the resolution report).
  const { data: head } = await runQuery<{ current_version?: number }>(
    "campaign_objects (current_version)",
    supabase
      .from("campaign_objects")
      .select("current_version")
      .eq("conversation_id", conversationId)
      .maybeSingle()
  );
  probe.dbVersion = head?.current_version ?? null;

  // 3) The exact Studio call — DB first, context_snapshot fallback. Wrapped so a
  //    transport failure is classified, not silently treated as "no object".
  let restored: CampaignObject | null = null;
  const loadStart = Date.now();
  console.log("  START query: loadCampaignObjectForConversation (Studio path)");
  try {
    restored = await withTimeout(
      "loadCampaignObjectForConversation",
      loadCampaignObjectForConversation(supabase, conversationId, contextSnapshot)
    );
    console.log(`  END query: loadCampaignObjectForConversation (${Date.now() - loadStart} ms) → ${restored ? "object" : "null"}`);
  } catch (err: any) {
    console.log(`  FAILED query: loadCampaignObjectForConversation (${Date.now() - loadStart} ms)`);
    console.log(`      Reason: ${classifyThrownError(err)}`);
    printFullError(err);
    throw err; // transport failure must NOT be misread as "no campaign object"
  }
  if (restored) {
    const source =
      probe.dbVersion && probe.dbVersion > 0 ? "db_persistence" : "context_snapshot";
    return { campaignObject: restored, source, probe };
  }

  // 4) Final Studio-carried source: the latest studio message metadata.
  const { data: messages } = await runQuery<Array<{ metadata: Record<string, any> | null }>>(
    "ai_messages (metadata fallback)",
    supabase
      .from("ai_messages")
      .select("metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
  );
  const rows = (messages ?? []) as Array<{ metadata: Record<string, any> | null }>;
  probe.studioMessageCount = rows.filter((m) => m?.metadata?.campaignObject).length;
  probe.messageMetadataHasObject = probe.studioMessageCount > 0;
  for (const m of rows) {
    const snap = m?.metadata?.campaignObject;
    if (snap) {
      return { campaignObject: deserializeCampaignObject(snap), source: "message_metadata", probe };
    }
  }

  return { campaignObject: null, source: "not_found", probe };
}

/**
 * Self-sufficient forensic sweep — runs ONLY when the Campaign Object cannot be
 * resolved. Instead of exiting with a one-liner, it inspects every layer the
 * Studio could load from and explains the failure, so the diagnostic never
 * requires a second investigation to investigate itself. Read-only throughout.
 */
async function investigateMissingCampaignObject(
  conversationId: string,
  resolution: CampaignObjectResolution
): Promise<void> {
  header("WHY THE CAMPAIGN OBJECT COULD NOT BE RESOLVED (self-check)");

  // 1) ai_conversations -------------------------------------------------------
  console.log("\n  [1] ai_conversations");
  const { data: convo } = await runQuery<any>(
    "forensics: ai_conversations",
    supabase
      .from("ai_conversations")
      .select("id, title, workspace_type, workspace_id, status, created_by, created_at, updated_at, context_snapshot")
      .eq("id", conversationId)
      .maybeSingle()
  );
  if (!convo) {
    console.log(`      NO ROW for id ${conversationId}.`);
    console.log(`      → Wrong conversation id, or this trace is pointed at a different environment/database`);
    console.log(`        than the one the Studio uses. Verify NEXT_PUBLIC_SUPABASE_URL matches the app.`);
  } else {
    line("id", convo.id);
    line("title", convo.title);
    line("workspace_type", convo.workspace_type);
    line("workspace_id", convo.workspace_id);
    line("status", convo.status);
    line("created_by", convo.created_by);
    line("created_at", convo.created_at);
    line("updated_at", convo.updated_at);
  }

  // 2) context_snapshot -------------------------------------------------------
  console.log("\n  [2] ai_conversations.context_snapshot");
  const snapshot = (convo?.context_snapshot ?? null) as Record<string, unknown> | null;
  if (!convo) {
    console.log("      (no conversation row — nothing to inspect)");
  } else if (!snapshot || Object.keys(snapshot).length === 0) {
    console.log("      context_snapshot is EMPTY.");
    console.log("      → The Studio never wrote a snapshot (updateConversationContextSnapshot is best-effort");
    console.log("        and swallows failures), so the fallback load path has nothing to return.");
  } else {
    line("top-level keys", keysOf(snapshot));
    line("has campaignObject", getCampaignObjectFromSnapshot(snapshot) != null);
    if (getCampaignObjectFromSnapshot(snapshot) == null) {
      console.log("      → Snapshot exists but carries no `campaignObject` key (only other AI context).");
    }
  }

  // 3) latest Studio message metadata -----------------------------------------
  console.log("\n  [3] ai_messages metadata (latest studio message)");
  const { data: messages } = await runQuery<Array<{ id: string; role: string; metadata: Record<string, any> | null; created_at: string }>>(
    "forensics: ai_messages",
    supabase
      .from("ai_messages")
      .select("id, role, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
  );
  const rows = (messages ?? []) as Array<{ id: string; role: string; metadata: Record<string, any> | null; created_at: string }>;
  line("total messages", rows.length);
  const withMeta = rows.filter((m) => m.metadata && Object.keys(m.metadata).length > 0);
  line("messages w/ metadata", withMeta.length);
  const withObject = rows.filter((m) => m.metadata?.campaignObject);
  line("carry campaignObject", withObject.length);
  const metaKeyUnion = new Set<string>();
  for (const m of withMeta) for (const k of Object.keys(m.metadata ?? {})) metaKeyUnion.add(k);
  line("distinct metadata keys", metaKeyUnion.size ? [...metaKeyUnion].join(", ") : "(none)");
  if (rows[0]) line("latest msg role/keys", `${rows[0].role} → ${keysOf(rows[0].metadata)}`);
  if (rows.length > 0 && withObject.length === 0) {
    console.log("      → Messages exist but none carry `metadata.campaignObject`. If the Studio still");
    console.log("        renders a campaign, it is hydrating from a source this probe does not cover");
    console.log("        (e.g. a differently-keyed metadata shape, or an in-memory/route-loader object).");
  }

  // 4) campaign_objects -------------------------------------------------------
  console.log("\n  [4] campaign_objects (DB persistence)");
  const { data: co } = await runQuery<any>(
    "forensics: campaign_objects",
    supabase
      .from("campaign_objects")
      .select("id, conversation_id, campaign_header_id, current_version, lifecycle_status, created_by, created_at, updated_at")
      .eq("conversation_id", conversationId)
      .maybeSingle()
  );
  if (!co) {
    console.log("      NO ROW for this conversation.");
    console.log("      → A Campaign Object was never persisted to the durable table for this conversation.");
  } else {
    line("id", co.id);
    line("current_version", co.current_version);
    line("lifecycle_status", co.lifecycle_status);
    line("campaign_header_id", co.campaign_header_id);
    line("created_at", co.created_at);
    line("updated_at", co.updated_at);
    if ((co.current_version ?? 0) <= 0) {
      console.log("      → Row exists but current_version <= 0: persistence was initialized but no version");
      console.log("        was ever committed, so loadLatestByConversation() returns null.");
    }
    // 5) campaign_object_versions --------------------------------------------
    console.log("\n  [5] campaign_object_versions");
    const { data: versions } = await runQuery<Array<{ version: number; created_at: string }>>(
      "forensics: campaign_object_versions",
      supabase
        .from("campaign_object_versions")
        .select("version, created_at")
        .eq("campaign_object_id", co.id)
        .order("version", { ascending: false })
    );
    const vrows = (versions ?? []) as Array<{ version: number; created_at: string }>;
    line("version count", vrows.length);
    if (vrows[0]) line("latest version", `${vrows[0].version} @ ${vrows[0].created_at}`);
    if (vrows.length === 0) {
      console.log("      → No version snapshots exist, so there is nothing for the DB path to deserialize.");
    }
  }

  // 6) conversation ↔ workspace link (is the object under a sibling convo?) ---
  console.log("\n  [6] conversation ↔ workspace link");
  if (!convo?.workspace_id) {
    console.log("      Conversation has no workspace_id — it is a standalone/general conversation.");
  } else {
    line("workspace", `${convo.workspace_type ?? "—"} / ${convo.workspace_id}`);
    const { data: siblings } = await runQuery<Array<{ id: string; status: string; updated_at: string }>>(
      "forensics: sibling conversations",
      supabase
        .from("ai_conversations")
        .select("id, status, updated_at")
        .eq("workspace_type", convo.workspace_type)
        .eq("workspace_id", convo.workspace_id)
        .order("updated_at", { ascending: false })
    );
    const sibRows = (siblings ?? []) as Array<{ id: string; status: string; updated_at: string }>;
    line("conversations for workspace", sibRows.length);
    let foundElsewhere: string | null = null;
    for (const s of sibRows) {
      if (s.id === conversationId) continue;
      const { data: sco } = await runQuery<{ id: string; current_version: number }>(
        "forensics: sibling campaign_objects",
        supabase
          .from("campaign_objects")
          .select("id, current_version")
          .eq("conversation_id", s.id)
          .maybeSingle()
      );
      if (sco && (sco.current_version ?? 0) > 0) {
        foundElsewhere = s.id;
        break;
      }
    }
    if (foundElsewhere) {
      console.log(`      → A DIFFERENT conversation for this SAME workspace has a persisted Campaign Object:`);
      console.log(`        ${foundElsewhere}`);
      console.log(`        The Studio likely opened that conversation, not ${conversationId}.`);
      console.log(`        Re-run the trace with that conversation id.`);
    } else if (sibRows.length > 1) {
      console.log("      → Sibling conversations exist for this workspace but none has a persisted object.");
    }
  }

  // Verdict -------------------------------------------------------------------
  header("RESOLUTION VERDICT");
  if (!convo) {
    console.log("  Cause: conversation does not exist in this database (wrong id or wrong environment).");
  } else if (co && (co.current_version ?? 0) > 0) {
    console.log("  Cause: a persisted Campaign Object EXISTS but the standard load path did not return it.");
    console.log("         Inspect the DB read path / RLS — this is unexpected and worth escalating.");
  } else if (resolution.probe.snapshotHasObject) {
    console.log("  Cause: object lives in context_snapshot; it should have resolved. Re-check the snapshot shape.");
  } else if (resolution.probe.messageMetadataHasObject) {
    console.log("  Cause: object lives in message metadata; it should have resolved. Re-check the metadata shape.");
  } else {
    console.log("  Cause: NO Campaign Object exists in any known layer (DB persistence, context_snapshot,");
    console.log("         message metadata) for this conversation. Either it was never persisted, it predates");
    console.log("         the persistence architecture, or the Studio renders it from a source not yet probed.");
    console.log("         If the Studio DOES render this campaign, that fourth source is the next thing to trace.");
  }
  console.log("");
}

// --- capture the existing traceCountDrop funnel (read-only, no logic change) --

type DropEvent = { stage: string; filter: string; before: number; after: number };
const drops: DropEvent[] = [];

function installTraceCapture() {
  const orig = { info: console.info, warn: console.warn };
  const capture = (fallback: (...a: unknown[]) => void) => (...args: unknown[]) => {
    const msg = args[0];
    if (typeof msg === "string" && msg.includes("[search-trace:")) {
      const data = args[1] as { filter?: string; countBefore?: number; countAfter?: number } | undefined;
      if (data && typeof data.countBefore === "number" && typeof data.countAfter === "number") {
        const stage = msg
          .replace(/^\[search-trace:[^\]]*\]\s*/, "")
          .replace(/^COUNT_DROP @ /, "")
          .trim();
        drops.push({ stage, filter: data.filter ?? "", before: data.countBefore, after: data.countAfter });
      }
      return; // suppress the raw trace line — we print a structured funnel instead
    }
    fallback(...args);
  };
  console.info = capture(orig.info) as typeof console.info;
  console.warn = capture(orig.warn) as typeof console.warn;
  return () => {
    console.info = orig.info;
    console.warn = orig.warn;
  };
}

// --- main --------------------------------------------------------------------

async function main() {
  const conversationId = process.argv[2];
  if (!conversationId || conversationId.startsWith("--")) {
    console.error("Usage: npx tsx scripts/trace-discovery.ts <conversationId> [--query=\"...\"]");
    process.exit(1);
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  DISCOVERY PIPELINE TRACE — conversation ${conversationId.slice(0, 18)}…`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);

  // 0a) Connection diagnostics + preflight — prove we can reach Supabase BEFORE
  //     interpreting any result. A failed query must never be read as "no row".
  printConnectionDiagnostics();

  header("CONNECTIVITY PREFLIGHT (simple SELECT on ai_conversations)");
  const preflight = await runQuery<Array<{ id: string }>>(
    "preflight: SELECT id FROM ai_conversations LIMIT 1",
    supabase.from("ai_conversations").select("id").limit(1)
  );
  if (preflight.error) {
    header("CONNECTIVITY FAILED — cannot query Supabase (NOT a missing row)");
    console.log(`  The diagnostic could not execute a basic SELECT. This is a CONNECTION problem,`);
    console.log(`  not a missing Campaign Object — do not interpret it as "conversation does not exist".`);
    console.log(`  Classification: ${preflight.classification}`);
    console.log("");
    console.log("  Most common fix (matches the dev server): run through the provided runner so Node");
    console.log("  gets --use-system-ca (corporate SSL inspection) and --dns-result-order=ipv4first:");
    console.log("      npm run trace:discovery -- <conversationId>");
    console.log("  If you are invoking tsx directly, add those flags via NODE_OPTIONS.");
    console.log("");
    process.exit(1);
  }
  console.log("  ✔ connectivity OK — Supabase is reachable and the service role can read.\n");

  // 0b) Campaign Object resolution — reproduce the exact Studio load path ------
  header("RESOLVING CAMPAIGN OBJECT (Studio load path)");
  const resolution = await resolveCampaignObjectLikeStudio(conversationId);
  header("CAMPAIGN OBJECT RESOLUTION (same path as the Studio)");
  line("conversation exists", resolution.probe.conversationExists);
  line("workspace", resolution.probe.conversationExists ? `${resolution.probe.workspaceType ?? "—"} / ${resolution.probe.workspaceId ?? "—"}` : "—");
  line("db persistence version", resolution.probe.dbVersion ?? "none");
  line("context_snapshot object", resolution.probe.snapshotHasObject);
  line("message-metadata object", `${resolution.probe.messageMetadataHasObject} (${resolution.probe.studioMessageCount} studio msg)`);
  line("RESOLVED SOURCE", resolution.source);

  const campaignObject = resolution.campaignObject;
  if (!campaignObject) {
    // Never stop at a one-liner — run the full self-check across every layer.
    await investigateMissingCampaignObject(conversationId, resolution);
    process.exit(1);
  }
  if (resolution.source !== "db_persistence") {
    console.log(`  ⚠ NOTE: object resolved from "${resolution.source}", not DB persistence — the Studio`);
    console.log(`    still works, but this campaign was never durably saved to campaign_objects.`);
  }

  const facts = getCampaignFacts(campaignObject);
  const lastSuccess = await loadLastSuccessfulVersion(
    (campaignObject as any).id,
    (campaignObject as any).version
  );
  const prevObject = lastSuccess?.campaignObject ?? null;
  const prevFacts = prevObject ? getCampaignFacts(prevObject) : undefined;
  const creatorsData = (campaignObject.sections?.creators?.data ?? {}) as Record<string, any>;
  const storedRecs: string[] = creatorsData?.recommendations?.creatorIds ?? [];
  const storedDiscovery: string[] = creatorsData?.discovery?.creatorIds ?? [];
  const reasoning: Array<{ expectedRole?: string }> = creatorsData?.recommendations?.selectedReasoning ?? [];
  const tierMix: Record<string, number> = {};
  for (const r of reasoning) {
    const t = r.expectedRole?.trim() || "Unclassified";
    tierMix[t] = (tierMix[t] ?? 0) + 1;
  }

  header("CAMPAIGN FACTS");
  line("client", facts?.clientName);
  line("brand", facts?.brandName);
  line("country / geography", facts?.geography);
  line("platforms", facts?.platforms);
  line("audience", facts?.audience);
  line("budget", facts?.budget ? `${facts.budget.amount} ${facts.budget.currency}` : null);
  line("objective", facts?.objective);
  line("kpis", facts?.kpis);
  line("creator mix (stored)", Object.entries(tierMix).map(([t, n]) => `${n} ${t}`));
  line("strategy?", typeof campaignObject.sections?.strategy?.content === "string" && campaignObject.sections.strategy.content.trim() ? "present" : "empty");

  // 2) Discovery query / filters (reconstructed via the REAL builder) ---------
  const query =
    argFlag("--query") ??
    facts?.rawBriefExcerpt ??
    [facts?.brandName, facts?.objective, facts?.audience, facts?.geography?.join(" "), facts?.platforms?.join(" ")]
      .filter(Boolean)
      .join(". ");

  const input = {
    query,
    country: facts?.geography?.[0],
    platforms: facts?.platforms,
    limit: 50,
  } as SearchCreatorsInput;

  const filters = searchCreatorsInputToBrowseFilters(input);
  const resolvedCategories = resolveBrowseCategories(filters);

  header("DISCOVERY QUERY (reconstructed from facts)");
  line("query", query?.slice(0, 100));
  line("original country", facts?.geography?.[0]);
  line("normalized country", resolveCountryCode(facts?.geography?.[0]));
  line("filters.country", filters.country);
  line("platform / platforms", filters.platforms ?? filters.platform);
  line("filters.categories", filters.categories);
  line("resolved categories", resolvedCategories);
  line("followers", `${filters.minFollowers ?? "—"} … ${filters.maxFollowers ?? "—"}`);

  // 3) Discovery control settings --------------------------------------------
  let settings: any;
  try {
    settings = await getDiscoveryControlSettings(supabase);
    header("DISCOVERY CONTROL SETTINGS");
    line("discoverySource", settings.discoverySource);
    line("searchPriority", settings.searchPriority);
    line("coverageThreshold", settings.coverageThreshold);
    line("automaticEnrichment", settings.automaticEnrichment);
    line("costProtection", settings.costProtection);
  } catch (e) {
    header("DISCOVERY CONTROL SETTINGS");
    console.log("  (failed to load:", (e as Error).message, ")");
  }

  // 4) Run the REAL browse + coverage/backfill (funnel captured) --------------
  header("DISCOVERY FUNNEL (fresh browse)");
  const restore = installTraceCapture();
  let result: any = null;
  let browseError: Error | null = null;
  try {
    result = await browseUnifiedCreatorsWithCoverageBackfill(
      supabase,
      { ...filters, page: 1 } as any,
      "discovery"
    );
  } catch (e) {
    browseError = e as Error;
  } finally {
    restore();
  }

  if (browseError) {
    console.log("  browse threw:", browseError.message);
  }

  const freshCount = result?.creators?.length ?? 0;
  const rpcStage = drops.find((d) => d.stage.startsWith("5_") || d.stage.includes("rpc"));
  console.log(`  RPC / search returned:  ${rpcStage ? rpcStage.before : "(see stages)"}`);
  if (drops.length === 0) {
    console.log("  (no traceCountDrop events captured — run with AI_SEARCH_TRACE=1, or npm run trace:discovery)");
  }
  for (const d of drops) {
    const removed = d.before - d.after;
    const flag = d.before > 0 && d.after === 0 ? "  ⟵ ZEROED" : "";
    console.log(`    ${d.stage.padEnd(26)} ${d.filter.padEnd(20)} ${String(d.before).padStart(5)} → ${String(d.after).padStart(5)}  (−${removed})${flag}`);
  }
  arrow();
  console.log(`  FINAL candidate pool:   ${freshCount}`);
  if (result?.coverage) {
    line("coverage level", result.coverage.coverageLevel);
    line("coverage score", result.coverage.coverageScore);
  }
  if (result?.backfill) {
    line("backfill executed", result.backfill.executed);
    line("backfill reason", result.backfill.reason);
    line("profiles added", result.backfill.profilesAdded);
  } else {
    line("backfill", "not triggered");
  }

  // 4b) RANKING DIAGNOSTICS — top 20 ranked candidates before proposal --------
  header("RANKING DIAGNOSTICS (top 20 ranked candidates — fresh browse)");
  const ranked: any[] = Array.isArray(result?.creators) ? result.creators : [];
  if (ranked.length === 0) {
    console.log("  (ranking produced 0 candidates — proposal has nothing to rank)");
  } else {
    console.log(
      `  ${"#".padStart(2)}  ${"creator".padEnd(24)} ${"score".padStart(6)}  ${"role".padEnd(10)} ${"category".padEnd(16)} platform`
    );
    ranked.slice(0, 20).forEach((c, i) => {
      const name = String(c?.display_name ?? c?.unified_id ?? "—").slice(0, 24);
      const score = c?.thinkway_score == null ? "—" : Number(c.thinkway_score).toFixed(1);
      const role = String(c?.role ?? "—").slice(0, 10);
      const category = String(c?.ai_category ?? c?.categories?.[0] ?? "—").slice(0, 16);
      const platform = c?.platforms?.[0]?.platform ?? "—";
      console.log(
        `  ${String(i + 1).padStart(2)}  ${name.padEnd(24)} ${String(score).padStart(6)}  ${role.padEnd(10)} ${category.padEnd(16)} ${platform}`
      );
    });
    if (ranked.length > 20) console.log(`  … +${ranked.length - 20} more`);
  }

  // 5) Persisted ground truth — latest coverage decision ----------------------
  header("LATEST discovery_coverage_decisions ROW (real Studio run)");
  try {
    const { data: decision } = await supabase
      .from("discovery_coverage_decisions")
      .select("database_creators_count, coverage_score, coverage_level, apify_executed, reason, duration_ms, search_query, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (decision) {
      line("created_at", decision.created_at);
      line("db creators count", decision.database_creators_count);
      line("coverage level", decision.coverage_level);
      line("coverage score", decision.coverage_score);
      line("apify executed", decision.apify_executed);
      line("reason", decision.reason);
      line("search_query", decision.search_query);
    } else {
      console.log("  (no rows)");
    }
  } catch (e) {
    console.log("  (failed to query:", (e as Error).message, ")");
  }

  // 5b) ACQUISITION PIPELINE — why the DB pool is empty ------------------------
  // The browse enqueues a discovery_jobs row + a BullMQ "discovery-run" job that
  // the SEPARATE services/discovery-worker consumes. If the worker never runs,
  // jobs stay `pending`; if it runs, they go `running`→`completed`/`failed`.
  // Combine job status with raw table counts to locate where acquisition stops.
  header("ACQUISITION PIPELINE (discovery_jobs + raw table counts)");

  const { data: jobs } = await runQuery<Array<any>>(
    "discovery_jobs (latest 10)",
    supabase
      .from("discovery_jobs")
      .select("id, status, method, job_type, profiles_discovered, error_message, created_at, started_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(10)
  );
  const jobRows = (jobs ?? []) as Array<Record<string, any>>;
  const byStatus: Record<string, number> = {};
  for (const j of jobRows) byStatus[j.status ?? "?"] = (byStatus[j.status ?? "?"] ?? 0) + 1;
  line("recent jobs", jobRows.length ? jobRows.length : "0 (no discovery_jobs ever created)");
  line("status breakdown", Object.keys(byStatus).length ? Object.entries(byStatus).map(([s, n]) => `${n} ${s}`) : "—");
  jobRows.slice(0, 5).forEach((j) => {
    const when = j.created_at ?? "?";
    const err = j.error_message ? ` err="${String(j.error_message).slice(0, 80)}"` : "";
    console.log(`    ${String(j.status ?? "?").padEnd(10)} ${String(j.method ?? j.job_type ?? "?").padEnd(24)} profiles=${j.profiles_discovered ?? 0}  ${when}${err}`);
  });

  // Raw counts (head+exact returns the count on the builder response, not data).
  const rawCount = async (label: string, q: any): Promise<number | null> => {
    const start = Date.now();
    console.log(`  START query: ${label}`);
    try {
      const res: any = await withTimeout(label, q);
      const ms = Date.now() - start;
      if (res?.error) {
        console.log(`  FAILED query: ${label} (${ms} ms) — ${classifySupabaseError(res.error)}`);
        printFullError(res.error);
        return null;
      }
      console.log(`  END query: ${label} (${ms} ms) → count=${res?.count ?? 0}`);
      return res?.count ?? 0;
    } catch (e: any) {
      console.log(`  FAILED query: ${label} (${Date.now() - start} ms) — ${classifyThrownError(e)}`);
      printFullError(e);
      return null;
    }
  };

  const discoveredTotal = await rawCount(
    "discovered_profiles total",
    supabase.from("discovered_profiles").select("id", { count: "exact", head: true })
  );
  const discoveredTikTok = await rawCount(
    "discovered_profiles where platform=tiktok",
    supabase.from("discovered_profiles").select("id", { count: "exact", head: true }).eq("platform", "tiktok")
  );
  const influencersActive = await rawCount(
    "influencers where status=active",
    supabase.from("influencers").select("id", { count: "exact", head: true }).eq("status", "active")
  );

  header("ACQUISITION VERDICT");
  if (jobRows.length === 0) {
    console.log("  No discovery_jobs rows exist — acquisition was never even enqueued/persisted.");
  } else if ((byStatus["pending"] ?? 0) === jobRows.length || (byStatus["pending"] ?? 0) + (byStatus["running"] ?? 0) === jobRows.length) {
    console.log("  Jobs are stuck at pending/running — the discovery-worker is NOT consuming the queue.");
    console.log("  → Start it (separate process): npm run discovery:worker  (needs REDIS_URL + worker .env).");
    console.log("    Verify local setup with: node scripts/verify-local-discovery.mjs");
  } else if ((byStatus["failed"] ?? 0) > 0) {
    console.log("  The worker RAN but jobs FAILED — see error_message above (Apify creds, crawl blocked, etc.).");
  } else if ((byStatus["completed"] ?? 0) > 0 && (discoveredTotal ?? 0) === 0) {
    console.log("  The worker COMPLETED but imported 0 profiles — acquisition returned nothing (source/creds/cost caps).");
  } else if ((discoveredTotal ?? 0) > 0 && (discoveredTikTok ?? 0) === 0) {
    console.log("  discovered_profiles has rows, but NONE for platform=tiktok — acquisition never covered TikTok.");
  } else if ((discoveredTikTok ?? 0) > 0 || (influencersActive ?? 0) > 0) {
    console.log("  The DB HAS candidates, yet browse returned 0 — the loss is in the browse query/filters, not acquisition.");
    console.log(`  (discovered tiktok=${discoveredTikTok}, active influencers=${influencersActive}). Re-inspect the RPC/category/follower filters.`);
  } else {
    console.log("  The database is empty of candidates and acquisition has not populated it.");
  }
  console.log("  Note: automaticEnrichment/costProtection (see DISCOVERY CONTROL SETTINGS) can disable Apify");
  console.log("  even when the worker runs — maxRequestsPerDay=0 / maxCreditsPerDay=0 blocks paid acquisition.");

  // 6) Stored campaign-object slate state -------------------------------------
  header("STORED SLATE STATE (what the real Studio run produced)");
  line("discovery.creatorIds", storedDiscovery.length);
  line("recommendations.creatorIds", storedRecs.length);
  line("slateProposalStatus", creatorsData?.slateProposalStatus);
  line("pendingProposal", creatorsData?.pendingProposal?.status ?? "—");
  line("phase", creatorsData?.phase);

  // 7) CURRENT vs LAST SUCCESSFUL — comparison sections -----------------------
  const prevQuery = reconstructQuery(prevFacts);
  const currQueryForDiff = query;

  header("CAMPAIGN FACTS DIFF (last successful → current)");
  if (!prevObject) {
    console.log(`  (no previous successful run in version history — nothing to compare)`);
  } else {
    console.log(`  baseline = version ${lastSuccess!.version} (recommendations.creatorIds > 0)\n`);
    diff("country", prevFacts?.geography, facts?.geography);
    diff("platforms", prevFacts?.platforms, facts?.platforms);
    diff("creator mix", creatorMixSummary(prevFacts), creatorMixSummary(facts));
    diff("objectives", prevFacts?.objective, facts?.objective);
    diff("audience", prevFacts?.audience, facts?.audience);
    diff("categories", buildCampaignSearchIntent(prevQuery).categories, buildCampaignSearchIntent(currQueryForDiff).categories);
    diff("timeline (weeks)", prevFacts?.durationWeeks, facts?.durationWeeks);
    diff("strategy", prevObject ? strategyState(prevObject) : "—", strategyState(campaignObject));
  }

  header("SEARCH STRATEGY DIFF (last successful → current)");
  if (!prevObject) {
    console.log(`  (no previous successful run to compare)`);
  } else {
    const prevIntent = buildCampaignSearchIntent(prevQuery);
    const currIntent = buildCampaignSearchIntent(currQueryForDiff);
    diff("industry", prevIntent.industry, currIntent.industry);
    diff("industryKey", prevIntent.industryKey, currIntent.industryKey);
    diff("country", prevIntent.country, currIntent.country);
    diff("platforms", prevIntent.platforms, currIntent.platforms);
    diff("categories", prevIntent.categories, currIntent.categories);
    diff("semanticKeywords", prevIntent.semanticKeywords?.slice(0, 8), currIntent.semanticKeywords?.slice(0, 8));
  }

  header("DISCOVERY FILTER DIFF (last successful → current)");
  if (!prevObject) {
    console.log(`  (no previous successful run to compare)`);
  } else {
    const prevFilters = searchCreatorsInputToBrowseFilters({
      query: prevQuery,
      country: prevFacts?.geography?.[0],
      platforms: prevFacts?.platforms,
      limit: 50,
    } as SearchCreatorsInput);
    diff("country", prevFilters.country, filters.country);
    diff("platforms", prevFilters.platforms ?? prevFilters.platform, filters.platforms ?? filters.platform);
    diff("categories", prevFilters.categories, filters.categories);
    diff("resolved categories", resolveBrowseCategories(prevFilters), resolvedCategories);
    diff("minFollowers", prevFilters.minFollowers, filters.minFollowers);
    diff("maxFollowers", prevFilters.maxFollowers, filters.maxFollowers);
  }

  header("CANDIDATE POOL DIFF (last successful → current)");
  {
    const currFunnel = slateFunnel(campaignObject);
    if (prevObject) {
      const prevF = slateFunnel(prevObject);
      console.log(`  previous (v${lastSuccess!.version}):  discovery ${prevF.discovery} → proposal ${prevF.recommendations} → selected ${prevF.selected}`);
    } else {
      console.log(`  previous:            (no successful run recorded)`);
    }
    const rpc = rpcStage ? rpcStage.before : freshCount;
    console.log(`  current (fresh):     RPC ${rpc} → post-filter ${freshCount} → proposal ${currFunnel.recommendations} → selected ${currFunnel.selected}`);
    if (freshCount === 0 && firstZeroDrop(drops)) {
      const z = firstZeroDrop(drops)!;
      console.log(`  loss point:          "${z.filter || z.stage}" filter zeroed the pool (${z.before} → 0)`);
    }
  }

  // 8) PROPOSAL DIAGNOSTICS — proposeInitialCreatorSlate (read-only) -----------
  header("PROPOSAL DIAGNOSTICS — proposeInitialCreatorSlate() (read-only)");
  {
    const inputPool =
      storedDiscovery.length > 0
        ? storedDiscovery.length
        : (creatorsData?.recommendations?.selectedReasoning ?? []).filter((r: any) => r?.creatorId?.trim()).length;
    try {
      const before = storedRecs.length;
      const proposalResult = proposeInitialCreatorSlateWithStatus(campaignObject, {});
      const afterData = (proposalResult.campaignObject.sections?.creators?.data ?? {}) as Record<string, any>;
      const output = afterData?.recommendations?.creatorIds?.length ?? 0;
      line("input pool", `${inputPool} creators (source: ${storedDiscovery.length > 0 ? "discovery" : "strategy vendors"})`);
      line("proposed", proposalResult.proposed);
      line("output", `${output} creators`);
      if (before > 0 && output === before && proposalResult.proposed) {
        line("note", "existing slate committed — proposal short-circuited (no re-rank)");
      }
      if (proposalResult.blockedReason) {
        line("blocked reason", proposalResult.blockedReason.reason);
        line("blocked message", proposalResult.blockedReason.message);
      } else if (!proposalResult.proposed) {
        line("skipped", "proposal returned proposed=false without a blockedReason");
      }
    } catch (e) {
      console.log("  (proposal threw:", (e as Error).message, ")");
    }
  }

  // 9) RECOMMENDATION DIAGNOSTICS — persisted slate outputs --------------------
  header("RECOMMENDATION DIAGNOSTICS (persisted slate outputs)");
  {
    const recIds: string[] = creatorsData?.recommendations?.creatorIds ?? [];
    line("recommendations.creatorIds", recIds.length ? `${recIds.length} [${recIds.slice(0, 5).join(", ")}${recIds.length > 5 ? ", …" : ""}]` : "0 (empty)");
    const display = creatorsData?.recommendationsDisplay;
    line("recommendationsDisplay", typeof display === "string" && display.trim() ? `present (${display.trim().length} chars)` : "empty");
    const decisions = creatorsData?.vendorDecisions;
    line("vendorDecisions", decisions == null ? "—" : Array.isArray(decisions) ? `${decisions.length} entries` : `${Object.keys(decisions).length} keys`);
    line("pendingProposal", creatorsData?.pendingProposal ? `${creatorsData.pendingProposal.status}${creatorsData.pendingProposal.error?.reason ? ` (${creatorsData.pendingProposal.error.reason})` : ""}` : "—");
    line("slateProposalStatus", creatorsData?.slateProposalStatus ? `${creatorsData.slateProposalStatus.status}${creatorsData.slateProposalStatus.reason ? ` (${creatorsData.slateProposalStatus.reason})` : ""}` : "—");
  }

  // 10) FINAL VERDICT ---------------------------------------------------------
  header("FINAL VERDICT — FIRST LOSS POINT");
  const firstDrop = drops.find((d) => d.before > 0 && d.after === 0);
  let verdict: string;
  if (freshCount === 0) {
    if (firstDrop) {
      console.log(`  Stage:   ${firstDrop.stage} (${firstDrop.filter})`);
      console.log(`  Before:  ${firstDrop.before} creators`);
      console.log(`  After:   ${firstDrop.after} creators`);
      console.log(`  Reason:  the "${firstDrop.filter}" filter removed all candidates.`);
      verdict = `${firstDrop.filter || firstDrop.stage} Filter — dropped ${firstDrop.before} candidates to 0.`;
    } else if (rpcStage && rpcStage.before === 0) {
      console.log(`  Stage:   ${rpcStage.stage} (RPC / SQL WHERE clause)`);
      console.log(`  Reason:  the database query returned 0 rows before any post-filter.`);
      verdict = `RPC — the database query returned 0 rows (check country/category/follower WHERE clause).`;
    } else {
      console.log(`  Stage:   Database / RPC search`);
      console.log(`  Reason:  Discovery returned 0 candidates. Backfill executed=${result?.backfill?.executed ?? false}` +
        ` (reason: ${result?.backfill?.reason ?? "n/a"}). If backfill was skipped, check coverageThreshold above.`);
      verdict = `Discovery — 0 candidates and backfill ${result?.backfill?.executed ? "did not recover" : "was skipped"} (${result?.backfill?.reason ?? "n/a"}).`;
    }
  } else if (storedDiscovery.length === 0) {
    console.log(`  Stage:   Studio search → persistence`);
    console.log(`  Fresh Discovery returns ${freshCount}, but the campaign object's discovery.creatorIds is EMPTY.`);
    console.log(`  Reason:  the Studio search did not run/complete or its results were not persisted.`);
    verdict = `Persistence — Discovery returns ${freshCount} creators, but discovery.creatorIds was never committed.`;
  } else if (storedRecs.length === 0) {
    console.log(`  Stage:   proposeInitialCreatorSlate()`);
    console.log(`  discovery.creatorIds=${storedDiscovery.length} but recommendations.creatorIds is EMPTY.`);
    console.log(`  Reason:  the proposal stage did not commit (status: ${creatorsData?.slateProposalStatus?.status ?? "?"}).`);
    verdict = `Proposal — ${storedDiscovery.length} discovered creators, but ranking/proposal produced 0 recommendations (status: ${creatorsData?.slateProposalStatus?.status ?? "?"}).`;
  } else {
    console.log(`  No loss detected in data: Discovery=${freshCount}, discovery.creatorIds=${storedDiscovery.length}, recommendations.creatorIds=${storedRecs.length}.`);
    console.log(`  If the UI still shows no cards, the loss is in rendering/hydration (Vendor Recommendations).`);
    verdict = `No data loss — Discovery=${freshCount}, discovery=${storedDiscovery.length}, recommendations=${storedRecs.length}. If UI is empty, loss is in rendering/hydration.`;
  }

  console.log(`\n  ══════════════════════════════════════════════════════════════`);
  console.log(`  ▶ FIRST LOSS POINT: ${verdict}`);
  console.log(`  ══════════════════════════════════════════════════════════════`);

  console.log("");
}

main().catch((e) => {
  console.error("\nTRACE FAILED:", e);
  process.exit(1);
});
