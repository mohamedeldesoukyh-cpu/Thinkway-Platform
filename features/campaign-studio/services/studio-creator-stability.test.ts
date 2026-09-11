/**
 * Creator actions must not cost the operator the screen they are working on,
 * and a decision must not make the package look stale.
 *
 * Four defects, all root-caused in code:
 *
 *   1. THE FIRST APPROVE EMPTIED THE CREATOR LIST. The section fed
 *      `useCreatorHydration` the Discovery pool while no change was staged and
 *      the slate preview once one was, so the very first decision changed the
 *      id set; the hook treated a changed set as a new slate and ran
 *      `setVendors([])`. The list blanked, the document collapsed (taking the
 *      scroll anchor with it) and the creators trickled back — a page refresh
 *      in everything but name.
 *   2. CREATORS DISAPPEARED WITH NO WAY BACK, for the same reason: the pool
 *      creators behind "other recommendations" were no longer in the id set at
 *      all, so they were not re-hydrated until the draft was applied.
 *   3. APPROVAL VANISHED. `vendorDecisions` has one slot per creator and the
 *      projection was last-write-wins, so selecting an approved creator
 *      overwrote "approved" with "shortlisted" — and Apply persisted that. The
 *      reverse also happened: Apply cleared the whole draft, so a selection on
 *      an approved creator had nowhere left to live.
 *   4. A DECISION MADE THE PACKAGE STALE. Package's slate included rejected
 *      creators while the Content plan excluded them, so one rejection made
 *      Content "refer to a previous creator slate"; and Discovery reported
 *      geography missing from enrichment records because the market
 *      requirement was matched against the creator's USERNAME.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
} from "@/features/campaign-intelligence/types/section-schemas";
import { buildCreatorRequirementEvidence } from "@/features/campaign-intelligence/services/reasoning/evidence-vendor-reasoning";
import { normalizeCreators } from "@/features/ai-workflows/formatters/creator-formatter";

import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { applicableDraftChanges, applyStudioDraftChanges, outdatedSectionsForDraft } from "./studio-draft";
import { outdatedStudioSections } from "./studio-facts-freshness";
import { resolveCreatorDecisionState, resolveStudioDecisionRows, approvedNotSelected } from "./studio-creator-decisions";
import { previewVendorDecisionsFromDraft } from "./studio-draft-preview";
import { resolveStudioDiscoverySufficiency } from "./studio-discovery-sufficiency";
import { resolveStudioPackageReadiness } from "./studio-package-readiness";

const readCode = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const SECTION =
  "features/campaign-studio/components/sections/vendor-recommendations-section.tsx";
const HYDRATION = "features/campaign-studio/hooks/use-creator-hydration.ts";

const at = "2026-05-01T00:00:00.000Z";
const approve = (creatorId: string): StudioDraftChange => ({
  kind: "approve_creator",
  creatorId,
  stagedAt: at,
});
const select = (creatorId: string): StudioDraftChange => ({
  kind: "shortlist_creator",
  creatorId,
  stagedAt: at,
});
const reject = (creatorId: string): StudioDraftChange => ({
  kind: "reject_creator",
  creatorId,
  stagedAt: at,
});

const VENDORS = [
  { id: "inf:a", displayName: "Creator A" },
  { id: "inf:b", displayName: "Creator B" },
  { id: "inf:c", displayName: "Creator C" },
];

const stateOf = (
  creatorId: string,
  changes: StudioDraftChange[],
  persisted: Record<string, "approved" | "rejected" | "shortlisted"> = {}
) => resolveCreatorDecisionState({ creatorId, persisted, changes });

function fixtureWithDraft(
  changes: StudioDraftChange[],
  extra?: Partial<CreatorsSectionData>
): CampaignObject {
  const object = buildCampaignObjectFixture();
  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  object.sections.creators.data = {
    ...creatorsData,
    ...extra,
    studioDraft: { changes, updatedAt: at },
  } as unknown as Record<string, unknown>;
  return object;
}

// ---------------------------------------------------------------------------
// A. The first approval.

test("A. the creator inventory id set does not change when the first decision is staged", () => {
  // The section hydrates the slate PLUS the pool it was drawn from, in both
  // states — so staging a change cannot re-key the hydration hook.
  const code = readCode(SECTION);
  assert.match(code, /const ids = dedupeCreatorIds\(\[\.\.\.slateIds, \.\.\.discoveryIds\]\);/);
  assert.doesNotMatch(
    code,
    /!usingDraftPreview && discoveryIds\.length > slateIds\.length \? discoveryIds/,
    "the id source must not flip on the first staged change"
  );
});

test("A. hydration prunes the inventory, it never empties it", () => {
  const code = readCode(HYDRATION);
  const reset = code.slice(code.indexOf("useEffect(() => {\n    const keep"));
  const body = reset.slice(0, reset.indexOf("}, [idsKey]);"));
  assert.match(body, /prev\.filter\(\(vendor\) => keep\.has\(normalizeIdKey\(vendor\.id\)\)\)/);
  assert.match(body, /next\.length === prev\.length \? prev : next/, "same members, same array");
  // Exactly one blanket clear remains, and it is the "no ids at all" case.
  assert.equal((code.match(/setVendors\(\[\]\)/g) ?? []).length, 1);
  assert.match(code, /if \(!idsKey\) \{\s*setVendors\(\[\]\)/);
});

test("A. a decision publishes the draft and nothing else", () => {
  const code = readCode(SECTION);
  const runner = code.slice(code.indexOf("const runCreatorDecision = useCallback"));
  const body = runner.slice(0, runner.indexOf("\n  );"));
  assert.match(body, /publishDraft\(result\.draft\)/);
  assert.doesNotMatch(body, /onVendorDecisionsUpdated|setVendorDecisions|deserializeCampaignObject/);
  assert.doesNotMatch(body, /router\.(refresh|push|replace)|window\.location/);
});

test("A. no creator action path scrolls the page", () => {
  for (const file of [
    SECTION,
    "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx",
  ]) {
    assert.doesNotMatch(
      readCode(file),
      /window\.scrollTo|scrollIntoView|restoreScrollPosition/,
      file
    );
  }
});

// ---------------------------------------------------------------------------
// B. Many approvals in a row.

test("B. approving A, B and C leaves all three approved", () => {
  const changes = [approve("inf:a"), approve("inf:b"), approve("inf:c")];
  for (const id of ["inf:a", "inf:b", "inf:c"]) {
    assert.equal(stateOf(id, changes).approved, true, id);
  }
  assert.equal(resolveStudioDecisionRows({ vendors: VENDORS, persisted: {}, changes }).length, 3);
});

test("B. a decision on one creator does not touch another", () => {
  const changes = [approve("inf:a"), select("inf:b"), reject("inf:c")];
  assert.deepEqual(stateOf("inf:a", changes), { approved: true, selected: false, rejected: false });
  assert.deepEqual(stateOf("inf:b", changes), { approved: false, selected: true, rejected: false });
  assert.deepEqual(stateOf("inf:c", changes), { approved: false, selected: false, rejected: true });
});

// ---------------------------------------------------------------------------
// C. Approval and selection together.

test("C. selecting an approved creator keeps the approval in the projection", () => {
  // The regression: last-write-wins turned "approved" into "shortlisted".
  const decisions = previewVendorDecisionsFromDraft({}, [approve("inf:a"), select("inf:a")]);
  assert.equal(decisions["inf:a"], "approved");
  // And the derived state still reports both facts.
  const state = stateOf("inf:a", [approve("inf:a"), select("inf:a")]);
  assert.equal(state.approved && state.selected, true);
});

test("C. a selection does not overwrite a persisted verdict either", () => {
  const decisions = previewVendorDecisionsFromDraft({ "inf:a": "approved" }, [select("inf:a")]);
  assert.equal(decisions["inf:a"], "approved");
  assert.equal(stateOf("inf:a", [select("inf:a")], { "inf:a": "approved" }).selected, true);
});

test("C. a selection is still projected for a creator with no verdict", () => {
  assert.equal(previewVendorDecisionsFromDraft({}, [select("inf:b")])["inf:b"], "shortlisted");
});

test("C. approve and reject still override each other in staged order", () => {
  assert.equal(previewVendorDecisionsFromDraft({}, [approve("inf:a"), reject("inf:a")])["inf:a"], "rejected");
  assert.equal(previewVendorDecisionsFromDraft({}, [reject("inf:a"), approve("inf:a")])["inf:a"], "approved");
});

// ---------------------------------------------------------------------------
// D. Approval after hydration / Apply.

test("D. an approval committed by Apply still reads approved with an empty draft", () => {
  assert.equal(stateOf("inf:a", [], { "inf:a": "approved" }).approved, true);
});

test("D. Apply persists the approval AND keeps the selection staged", () => {
  const object = fixtureWithDraft([approve("cr_macro1"), select("cr_macro1"), select("cr_micro1")]);
  const result = applyStudioDraftChanges(object);
  const data = (result.campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;

  assert.equal(data.vendorDecisions?.["cr_macro1"], "approved", "the verdict is persisted");
  // Selection is not a slate edit: it stays staged until Generate Shortlist.
  assert.deepEqual(
    result.unappliedChanges.map((change) => change.kind),
    ["shortlist_creator", "shortlist_creator"]
  );
  assert.deepEqual(
    data.studioDraft?.changes.map((change) => "creatorId" in change ? change.creatorId : ""),
    ["cr_macro1", "cr_micro1"]
  );

  // Both facts survive the apply, read through the canonical resolver.
  const after = resolveCreatorDecisionState({
    creatorId: "cr_macro1",
    persisted: data.vendorDecisions,
    changes: data.studioDraft?.changes,
  });
  assert.equal(after.approved && after.selected, true);
});

test("D. Apply still clears everything that IS a slate edit", () => {
  const object = fixtureWithDraft([
    { kind: "remove_creator", creatorId: "cr_micro1", stagedAt: at },
    approve("cr_macro1"),
  ]);
  const result = applyStudioDraftChanges(object);
  const data = (result.campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  assert.equal(data.studioDraft, undefined);
  assert.deepEqual(result.unappliedChanges, []);
  assert.ok(!(data.recommendations?.creatorIds ?? []).includes("cr_micro1"));
});

// ---------------------------------------------------------------------------
// E. Inventory stability.

test("E. the hydrated inventory keeps every creator that is still in the set", () => {
  // What the prune does, stated as data: retained ids keep their vendors.
  const keep = new Set(["a", "b"]);
  const prev = [{ id: "inf:a" }, { id: "inf:b" }, { id: "inf:gone" }];
  const next = prev.filter((vendor) => keep.has(vendor.id.replace(/^inf:/, "")));
  assert.deepEqual(next.map((v) => v.id), ["inf:a", "inf:b"]);
});

test("E. loading is derived from what has hydrated, not from the id set changing", () => {
  const code = readCode(HYDRATION);
  assert.match(code, /setLoading\(dnaDoneRef\.current\.size === 0\)/);
  assert.doesNotMatch(code, /setLoading\(true\);?\s*\n\s*setVendors\(\[\]\)/);
});

test("E. pending state is per creator, never a global creator-list loader", () => {
  const code = readCode(SECTION);
  assert.match(code, /pendingIds: pendingCreatorId \? \[pendingCreatorId\] : \[\]/);
  assert.doesNotMatch(code, /setLoadingAll|isLoadingCreators|globalLoading/);
});

// ---------------------------------------------------------------------------
// F. Selection persistence across approvals.

test("F. approving and unapproving never clears a selection", () => {
  const changes = [select("inf:a"), select("inf:b"), select("inf:c"), approve("inf:a")];
  const rows = resolveStudioDecisionRows({ vendors: VENDORS, persisted: {}, changes });
  assert.equal(rows.filter((row) => row.selected).length, 3);
  assert.equal(rows.find((row) => row.creatorId === "inf:a")!.approved, true);

  // Unapproving A drops only the approval.
  const unapproved = changes.filter((change) => change.kind !== "approve_creator");
  const after = resolveStudioDecisionRows({ vendors: VENDORS, persisted: {}, changes: unapproved });
  assert.equal(after.filter((row) => row.selected).length, 3);
  assert.equal(after.find((row) => row.creatorId === "inf:a")!.approved, false);
});

// ---------------------------------------------------------------------------
// G. The Approved panel.

test("G. counts are correct, and add-all adds each approved creator once", () => {
  const changes = [approve("inf:a"), approve("inf:b"), select("inf:b")];
  const rows = resolveStudioDecisionRows({ vendors: VENDORS, persisted: {}, changes });
  assert.equal(rows.filter((row) => row.approved).length, 2);
  assert.equal(rows.filter((row) => row.selected).length, 1);
  assert.deepEqual(approvedNotSelected(rows).map((row) => row.creatorId), ["inf:a"]);

  const after = resolveStudioDecisionRows({
    vendors: VENDORS,
    persisted: {},
    changes: [...changes, ...approvedNotSelected(rows).map((row) => select(row.creatorId))],
  });
  assert.equal(after.length, 2, "no duplicate rows");
  assert.ok(after.every((row) => row.approved && row.selected));
  assert.deepEqual(approvedNotSelected(after), []);
});

// ---------------------------------------------------------------------------
// H. Package Discovery readiness.

test("H. a confirmed campaign market is never reported as a missing creator field", () => {
  // Geography is judged on the creator's country, not on their username.
  const [creator] = normalizeCreators([
    {
      id: "inf:1",
      handle: "esraafahmy",
      displayName: "Esraa Fahmy",
      platform: "instagram",
      followers: 120_000,
      engagementRate: 3.4,
      campaignRelevanceScore: 71,
      country_code: "EG",
    },
  ]);
  assert.equal(creator!.country, "EG");

  const evidence = buildCreatorRequirementEvidence(creator!, {
    brand: "Kérastase",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt",
    geography: "Egypt",
    platforms: ["instagram", "tiktok"],
    durationWeeks: 4,
    budgetAmount: 3_000_000,
    budgetCurrency: "EGP",
  } as Parameters<typeof buildCreatorRequirementEvidence>[1]);

  const geography = evidence.find((item) => item.requirement.startsWith("Geography:"))!;
  assert.equal(geography.matched, true, "EG matches Egypt");
  assert.equal(geography.dataMissing, false);
  assert.match(geography.evidence, /country EG matches Egypt/);
});

test("H. a creator with no country on record is still an honest enrichment gap", () => {
  const [creator] = normalizeCreators([
    { id: "inf:2", handle: "someone", displayName: "Someone", platform: "instagram", followers: 10, engagementRate: 1, campaignRelevanceScore: 60 },
  ]);
  const evidence = buildCreatorRequirementEvidence(creator!, {
    brand: "Kérastase",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt",
    geography: "Egypt",
    platforms: ["instagram"],
    durationWeeks: 4,
  } as Parameters<typeof buildCreatorRequirementEvidence>[1]);
  const geography = evidence.find((item) => item.requirement.startsWith("Geography:"))!;
  assert.equal(geography.matched, false);
  assert.equal(geography.dataMissing, true, "nothing to read — a real gap");
});

test("H. a creator outside the market is a fit judgement, not missing data", () => {
  const [creator] = normalizeCreators([
    { id: "inf:3", handle: "dubai_creator", displayName: "Dubai Creator", platform: "instagram", followers: 10, engagementRate: 1, campaignRelevanceScore: 60, country_code: "AE" },
  ]);
  const evidence = buildCreatorRequirementEvidence(creator!, {
    brand: "Kérastase",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt",
    geography: "Egypt",
    platforms: ["instagram"],
    durationWeeks: 4,
  } as Parameters<typeof buildCreatorRequirementEvidence>[1]);
  const geography = evidence.find((item) => item.requirement.startsWith("Geography:"))!;
  assert.equal(geography.matched, false);
  assert.equal(geography.dataMissing, false, "the country is known — nothing to enrich");
});

test("H. enrichment gaps are read from the current slate only", () => {
  const object = buildCampaignObjectFixture();
  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  const ids = creatorsData.recommendations?.creatorIds ?? [];
  object.sections.creators.data = {
    ...creatorsData,
    phase: "proposal",
    discovery: { creatorIds: ids, total: 40 },
    lastDiscoveryAt: at,
    recommendations: {
      ...creatorsData.recommendations,
      creatorIds: ids,
      selectedReasoning: [
        ...(creatorsData.recommendations?.selectedReasoning ?? []),
        // A creator who left the slate, still carrying a gap.
        {
          creatorId: "cr_departed",
          displayName: "Departed",
          whySelected: "was on an earlier slate",
          expectedRole: "Micro",
          audienceMatch: "",
          risk: "",
          alternative: "",
          confidence: 0.5,
          evidence: "",
          tradeoff: "",
          missingData: ["Geography"],
        },
      ],
    },
  } as unknown as Record<string, unknown>;

  const sufficiency = resolveStudioDiscoverySufficiency(object, false);
  assert.deepEqual(sufficiency.missingIntelligence, [], "off-slate rows are not campaign gaps");
  assert.notEqual(sufficiency.state, "enrichment_required");
});

test("H. a gap on a creator who IS on the slate still holds Discovery back", () => {
  const object = buildCampaignObjectFixture();
  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  const ids = creatorsData.recommendations?.creatorIds ?? [];
  const reasoning = (creatorsData.recommendations?.selectedReasoning ?? []).map((entry, index) =>
    index === 0 ? { ...entry, missingData: ["Engagement rate"] } : entry
  );
  object.sections.creators.data = {
    ...creatorsData,
    phase: "proposal",
    discovery: { creatorIds: ids, total: 40 },
    lastDiscoveryAt: at,
    recommendations: { ...creatorsData.recommendations, creatorIds: ids, selectedReasoning: reasoning },
  } as unknown as Record<string, unknown>;

  const sufficiency = resolveStudioDiscoverySufficiency(object, false);
  assert.deepEqual(sufficiency.missingIntelligence, ["Engagement rate"]);
  assert.equal(sufficiency.state, "enrichment_required");
  assert.match(sufficiency.detail, /enrichment records of creators on this slate/);
  assert.match(sufficiency.detail, /not from the campaign's confirmed facts/);
  assert.match(sufficiency.nextAction, /current slate/);
  assert.doesNotMatch(sufficiency.detail, /whole database\b(?!\.)/);
});

// ---------------------------------------------------------------------------
// I. Package freshness.

test("I. rejecting a creator does not make Content outdated", () => {
  const object = buildCampaignObjectFixture();
  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  const ids = creatorsData.recommendations?.creatorIds ?? [];
  object.sections.creators.data = {
    ...creatorsData,
    vendorDecisions: { [ids[0]!]: "rejected" },
  } as unknown as Record<string, unknown>;

  // Content excludes the rejected creator …
  const plan = deriveInfluencerContentPlan(object);
  assert.ok(!plan.some((item) => item.creatorId === ids[0]));
  assert.equal(plan.length, ids.length - 1);

  // … and Package reads the same slate, so it does not call Content stale.
  const content = resolveStudioPackageReadiness(object).checks.find((item) => item.id === "content");
  assert.doesNotMatch(content?.reason ?? "", /previous creator slate/);
});

test("I. Content is still reported outdated when it genuinely is", () => {
  // Aligning the slate rule did not weaken the freshness signal: the canonical
  // outdated set (and the content_calendar output status) still decides.
  const object = buildCampaignObjectFixture();
  const readiness = resolveStudioPackageReadiness(object, {
    outdatedSections: new Set(["content-plan" as const]),
  });
  const content = readiness.checks.find((item) => item.id === "content")!;
  assert.equal(content.state, "outdated");
  assert.match(content.reason ?? "", /previous strategy or creator slate/);
});

test("I. Timeline and Commercial are judged against confirmed facts", () => {
  const object = buildCampaignObjectFixture({
    facts: { durationWeeks: 4, budget: { amount: 3_000_000, currency: "EGP" } },
  });
  const readiness = resolveStudioPackageReadiness(object);
  const timeline = readiness.checks.find((item) => item.id === "timeline")!;
  const commercial = readiness.checks.find((item) => item.id === "commercial")!;
  // Whatever the verdict, it must be stated against the confirmed numbers —
  // never a bare "outdated" with no measurement.
  if (!timeline.ready) assert.match(timeline.reason ?? "", /4 weeks|duration/i);
  if (!commercial.ready) assert.match(commercial.reason ?? "", /budget|slate|currency/i);
});

test("I. an ungenerated Proposal does not blame prerequisites that are current", () => {
  const object = buildCampaignObjectFixture();
  const readiness = resolveStudioPackageReadiness(object);
  const upstreamReady = ["strategy", "creators", "content", "commercial", "timeline"].every(
    (id) => readiness.checks.find((item) => item.id === id)?.ready
  );
  for (const id of ["proposal", "presentation"] as const) {
    const check = readiness.checks.find((item) => item.id === id)!;
    if (check.ready) continue;
    if (upstreamReady) {
      assert.match(check.action ?? "", new RegExp(`Generate ${check.label}`));
      assert.doesNotMatch(
        check.action ?? "",
        /after Strategy, Creators, Content, Commercial, and Timeline are current/,
        "it must not ask for prerequisites that are already current"
      );
    } else {
      // Otherwise it names the ones that actually are not current.
      assert.match(check.action ?? "", /Bring .+ current, then generate/);
    }
  }
});

test("I. staging an approval or a selection marks NOTHING outdated", () => {
  // The Package cascade: one Approve used to mark Content, Commercial,
  // Timeline, Proposal and Presentation outdated, because approvals were
  // classified as slate changes.
  for (const change of [approve("inf:a"), select("inf:a")]) {
    assert.deepEqual(
      [...outdatedSectionsForDraft({ changes: [change], updatedAt: at })],
      [],
      change.kind
    );
  }
  const object = fixtureWithDraft([approve("cr_macro1"), select("cr_macro1")]);
  const readiness = resolveStudioPackageReadiness(object, {
    outdatedSections: outdatedStudioSections(object, { changes: [approve("cr_macro1")], updatedAt: at }),
  });
  for (const id of ["content", "commercial", "timeline"] as const) {
    assert.notEqual(
      readiness.checks.find((item) => item.id === id)?.state,
      "outdated",
      `${id} must not be outdated because a creator was approved`
    );
  }
});

test("I. a real slate edit still marks the plan outdated", () => {
  const outdated = outdatedSectionsForDraft({
    changes: [{ kind: "remove_creator", creatorId: "inf:a", stagedAt: at }],
    updatedAt: at,
  });
  for (const section of ["content-plan", "budget-planner", "timeline"] as const) {
    assert.ok(outdated.has(section), section);
  }
  // And a rejection does, because the creator leaves the effective plan.
  assert.ok(outdatedSectionsForDraft({ changes: [reject("inf:a")], updatedAt: at }).has("content-plan"));
});

test("I. a staged selection is not a pending change awaiting Apply", () => {
  assert.deepEqual(
    applicableDraftChanges({ changes: [select("inf:a"), select("inf:b")], updatedAt: at }),
    []
  );
  assert.deepEqual(
    applicableDraftChanges({ changes: [select("inf:a"), approve("inf:b")], updatedAt: at }).map(
      (change) => change.kind
    ),
    ["approve_creator"]
  );
  // The Apply bar and its host both read that, so a retained selection cannot
  // leave an Apply bar the operator can never clear.
  assert.match(
    readCode("features/campaign-studio/components/campaign-studio.tsx"),
    /applicableDraftChanges\(studioDraft\)\.length > 0/
  );
  const bar = readCode("features/campaign-studio/components/studio-draft-bar.tsx");
  assert.match(bar, /const pending = applicableDraftChanges\(draft\);/);
  assert.match(bar, /if \(pending\.length === 0\) return null;/);
});

// ---------------------------------------------------------------------------
// J. Cross-screen alignment.

test("J. Content, the readiness slate and the decisions agree after a rejection", () => {
  const object = buildCampaignObjectFixture();
  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  const ids = creatorsData.recommendations?.creatorIds ?? [];
  object.sections.creators.data = {
    ...creatorsData,
    vendorDecisions: { [ids[1]!]: "rejected", [ids[2]!]: "approved" },
  } as unknown as Record<string, unknown>;

  const plan = deriveInfluencerContentPlan(object);
  const planIds = plan.map((item) => item.creatorId);
  assert.ok(!planIds.includes(ids[1]), "the rejected creator is out of Content");
  assert.ok(planIds.includes(ids[2]), "the approved creator is in Content");

  const readiness = resolveStudioPackageReadiness(object);
  assert.equal(
    readiness.checks.find((item) => item.id === "content")?.reason?.includes("previous creator slate"),
    undefined
  );
  // And the approval is still readable as an approval.
  assert.equal(
    resolveCreatorDecisionState({
      creatorId: ids[2]!,
      persisted: (object.sections.creators.data as CreatorsSectionData).vendorDecisions,
      changes: [],
    }).approved,
    true
  );
});
