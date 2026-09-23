import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as selection from "@/lib/domains/commercial/quotation-convert-selection";
import * as snapshot from "@/lib/domains/commercial/quotation-convert-snapshot";
import * as policy from "./quotation-append-policy";
import { makeCreatorFx } from "@/lib/commercial/creator-fx";
import { resolveLinePoBillableBase } from "@/lib/finance/po/billable-base";

// Exercise the actual orchestration with in-memory database and external services.
// This verifies writes and early-return behavior without touching campaign records.
function fixture(options: { status?: string; targetBrand?: string; existing?: boolean; readError?: boolean; customFx?: boolean } = {}) {
  const item = { id: "new-item", influencer_id: "creator", creator_name: "New creator", source_shortlist_item_id: "shortlist-item", option_number: 1, sort_order: 0, cost: 100, revenue: 250, af_pct: 5, deliverables: [{ platform: "instagram", type: "reel", quantity: 2 }] };
  Object.assign(item, { cost_currency: "USD", cost_fx_override: options.customFx ? makeCreatorFx("USD", "EGP", 52, 1) : null, revenue_fx_override: options.customFx ? makeCreatorFx("USD", "EGP", 55, 1) : null });
  const quote = { status: options.status ?? "approved", brand_id: "brand", client_id: "client", currency: "EGP", shortlist_id: "shortlist" };
  const writes: { kind: string; payload: Record<string, unknown> }[] = [];
  const target = { id: "campaign", document_number: "TW-TEST", brand_id: options.targetBrand ?? "brand", client_id: "client", status: "active" };
  const supabase = { from(table: string) {
    let columns = "";
    const response = () => {
      if (table === "campaign_headers") return { data: target, error: null };
      if (table === "quotation_items") return { data: columns === "id, source_shortlist_item_id" ? [{ id: "old-version-item", source_shortlist_item_id: "shortlist-item" }] : [item], error: null };
      if (table === "campaign_lines") return { data: options.existing ? [{ id: "old-line", source_quotation_item_id: "old-version-item" }] : [], error: options.readError ? { message: "Read failed" } : null };
      if (table === "influencers") return { data: { id: "creator", display_name: "New creator" }, error: null };
      if (table === "campaign_influencers") return { data: null, error: null };
      throw new Error(`Unexpected table ${table}`);
    };
    const query = { select(value: string) { columns = value; return query; }, eq() { return query; }, in() { return query; }, order() { return query; }, maybeSingle: async () => response(), then(resolve: (v: unknown) => unknown) { return Promise.resolve(response()).then(resolve); } };
    return query;
  } };
  const mocks = {
    ...selection, ...snapshot, ...policy,
    resolveLinePoBillableBase,
    loadQuotationRow: async () => quote,
    canCreateCampaignFromQuotation: (s: string) => s === "approved",
    isQuotationExpired: () => false,
    resolveCampaignDisplayName: (s: string) => s,
    normalizeCreatorId: (s: string) => s,
    resolveQuotationServiceDescription: () => "2 Instagram reels",
    fetchInfluencerPlatformAccounts: async () => ({ data: [] }),
    mapQuotationItemsToExecutionLineSeeds: ({ items }: { items: { cost: number; revenue: number; deliverables: unknown[] }[] }) => [{ influencerId: "creator", displayName: "New creator", platforms: items[0].deliverables, revenue: items[0].revenue, cost: items[0].cost, currencyCode: "EGP", scheduleHints: [] }],
    createCampaignLine: async (_db: unknown, _user: string, payload: Record<string, unknown>, id: { lineId: string }) => { writes.push({ kind: "line", payload: { ...payload, id: id.lineId } }); return { ok: true, lineId: id.lineId }; },
    logQuotationLifecycleEvent: async (_db: unknown, payload: Record<string, unknown>) => { writes.push({ kind: "audit", payload }); },
    isRelease20AssignmentConvertEnabled: () => false,
  };
  const source = readFileSync("lib/services/campaigns/convert-quotation-to-assignments.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", compiled)(() => mocks, exports);
  const convert = exports.convertQuotationToAssignments as typeof import("./convert-quotation-to-assignments").convertQuotationToAssignments;
  const run = (dryRun: boolean) => convert(supabase as never, "user", { quotationId: "quote", appendToCampaignId: "campaign", itemIds: [item.id], dryRun });
  return { run, writes, target };
}

test("preview performs no writes; append copies only selected pricing and deliverables and preserves active campaign", async () => {
  const f = fixture();
  const preview = await f.run(true);
  assert.equal(preview.ok, true);
  assert.deepEqual(f.writes, []);
  const result = await f.run(false);
  assert.equal(result.ok, true);
  assert.deepEqual(f.writes.map(w => w.kind), ["line", "audit"]);
  assert.equal(f.target.status, "active");
  assert.equal(f.writes[0].payload.source_quotation_item_id, "new-item");
  assert.equal(f.writes[0].payload.revenue, 250);
  assert.equal(f.writes[0].payload.cost, 100);
  assert.equal(JSON.parse(String(f.writes[0].payload.assignment_json)).platforms[0].quantity, 2);
});

test("quotation conversion carries independent custom rates; normal quotes remain unmodified", async () => {
  for (const customFx of [false, true]) {
    const f = fixture({ customFx });
    assert.equal((await f.run(false)).ok, true);
    const line = f.writes.find(w => w.kind === "line")!.payload;
    assert.equal(line.cost_fx_override, customFx ? makeCreatorFx("USD", "EGP", 52, 1) : null);
    assert.equal(line.revenue_fx_override, customFx ? makeCreatorFx("USD", "EGP", 55, 1) : null);
  }
});
test("creator already transferred from previous quotation version is not duplicated", async () => {
  const f = fixture({ existing: true });
  const result = await f.run(false);
  assert.ok(result.ok && result.alreadyExists);
  assert.deepEqual(f.writes, []);
});
test("unapproved quotation, incompatible target and failed duplicate lookup fail without writes", async () => {
  for (const opts of [{ status: "draft" }, { targetBrand: "other" }, { readError: true }]) {
    const f = fixture(opts);
    assert.equal((await f.run(false)).ok, false);
    assert.deepEqual(f.writes, []);
  }
});
