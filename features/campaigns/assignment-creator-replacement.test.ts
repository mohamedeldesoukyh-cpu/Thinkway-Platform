import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { replacementPlatformSelections } from "./assignment-creator-replacement";
import { resolveCreatorPickerSearchInput } from "@/features/creators/picker/creator-picker-search-display";
import { parseProfileInputList } from "@/lib/social/parse-profile-url";
import type { InfluencerAssignmentProfile } from "./types";

const account = { id: "new-account", platform: "instagram", handle: "toffee.tiny", profile_url: "https://www.instagram.com/toffee.tiny/", follower_count: 25000, engagement_rate: 2, audience_country: "EG" };
const profile = { id: "new-creator", display_name: "Toffee", platforms: [account], suggested_currency: "USD", vat_registered: false, suggested_cost_vat_percent: 0 } as InfluencerAssignmentProfile;
const existing = [{ ...account, account_id: "old-account", handle: "thetinytoffee", selected: true, deliverables: ["instagram_reel"] }];

test("profile URLs with reels suffix resolve through the shared shortlist search and paste parsers", () => {
  const url = "https://www.instagram.com/toffee.tiny/reels/";
  const parsed = parseProfileInputList(url);
  assert.equal(parsed.parsed[0].normalized_username, "toffee.tiny");
  assert.equal(parsed.invalid.length, 0);
  assert.equal(resolveCreatorPickerSearchInput(url), "@toffee.tiny");
});

test("replacement retains the deliverable plan while using only new creator account details", () => {
  const before = structuredClone(existing);
  const result = replacementPlatformSelections(profile, existing);
  assert.deepEqual(result[0].deliverables, existing[0].deliverables);
  assert.equal(result[0].account_id, "new-account");
  assert.equal(result[0].handle, "toffee.tiny");
  assert.equal(result[0].selected, true);
  assert.deepEqual(existing, before);
});

test("missing or ambiguous replacement accounts cannot silently discard the plan", () => {
  assert.throws(() => replacementPlatformSelections({ ...profile, platforms: [] }, existing), /needs a instagram account/);
  assert.throws(() => replacementPlatformSelections({ ...profile, platforms: [account, { ...account, id: "second" }] }, existing), /multiple instagram accounts/);
  assert.throws(() => replacementPlatformSelections(profile, [], ["tiktok"]), /needs a tiktok account/);
});

// Execute the actual form loader with a fake network and setter boundary. No database writes.
function loaderHarness(options: { isEdit?: boolean; fail?: boolean } = {}) {
  const source = readFileSync(new URL("./components/campaign-line-sheet.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  async function loadProfile(");
  const end = source.indexOf("\n  useEffect", start);
  const code = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 });
  const values: Record<string, unknown> = { currency: "EGP", costVatPercent: 14, costVatExempt: false, cost: 40000, revenue: 55000, influencerId: "old-creator" };
  const setters = Object.fromEntries(["LoadingProfile", "Profile", "Selections", "Currency", "CostVatPercent", "CostVatExempt", "InfluencerId", "InfluencerLabel"].map(name => [`set${name}`, (value: unknown) => { values[name[0].toLowerCase() + name.slice(1)] = value; }]));
  const deps = { ...setters, profileRequest: { current: 0 }, isEdit: options.isEdit ?? true, currencyCode: "EGP", pricingMode: "package", commercialRows: [], replacementPlatformSelections,
    buildInitialSelections: () => existing, toast: { error: () => {} },
    fetch: async () => ({ json: async () => options.fail ? { error: "Unavailable" } : { profile } }) };
  const load = new Function(...Object.keys(deps), `${code}; return loadProfile;`)(...Object.values(deps)) as (id: string, previous?: typeof existing, replacement?: boolean) => Promise<boolean>;
  return { values, load };
}

test("changing creator retains current cost, revenue, currency and VAT despite new profile defaults", async () => {
  const { values, load } = loaderHarness();
  assert.equal(await load("new-creator", existing, true), true);
  assert.deepEqual([values.cost, values.revenue, values.currency, values.costVatPercent, values.costVatExempt], [40000, 55000, "EGP", 14, false]);
  assert.equal(values.influencerId, "new-creator");
});

test("opening an existing assignment does not replace its saved VAT or currency with profile defaults", async () => {
  const { values, load } = loaderHarness();
  await load("old-creator", existing);
  assert.equal(values.currency, "EGP");
  assert.equal(values.costVatPercent, 14);
});

test("a failed profile load leaves the selected creator and prices intact", async () => {
  const { values, load } = loaderHarness({ fail: true });
  assert.equal(await load("new-creator", existing, true), false);
  assert.equal(values.influencerId, "old-creator");
  assert.equal(values.cost, 40000);
  assert.equal(values.loadingProfile, false);
});
