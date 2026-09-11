/**
 * The Studio campaign header, and what must not have changed around it.
 *
 * The Studio route rendered the white global Thinkway header AND the blue
 * campaign header, and the blue one showed a campaign UUID
 * ("20ae6f6e-2df4-…") where the brand belongs, because the panel passed
 * `campaignObjectId.slice(0, 14)` as the campaign code.
 *
 * Campaign Mode's own contract is that the Studio IS the application: the
 * campaign mast is the first application header, the way the Shortlist and
 * Quotation workspaces read. The route cannot drop the shell header
 * server-side, because the same route also renders plain Copilot chat, which
 * needs it — so the mast claims the shell's chrome while mounted and releases
 * it on unmount, scoped to a marker no other module carries.
 *
 * Source-contract tests. No rendering, and no browser run is claimed.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { resolveDisplayCampaignCode } from "./section-data-resolver";

const MAST = "features/campaign-studio/components/studio-top-chrome.tsx";
const SHELL = "components/layout/dashboard-shell.tsx";
const PANEL = "features/ai-workspace/components/campaign-studio-panel.tsx";
const WORKSPACE_CSS = "app/styles/campaign-workspace.css";
const CARDS = "features/campaign-studio/components/sections/vendor-recommendations-section.tsx";

const read = (file: string) => readFileSync(file, "utf8");

// ---------------------------------------------------------------------------
// One application header on the Studio route.

test("the campaign mast claims the shell's chrome, and releases it", () => {
  const mast = read(MAST);
  assert.match(mast, /data-dashboard-shell-root/, "it targets the shell it is mounted in");
  assert.match(mast, /pageOwnsChrome = "true"/);
  assert.match(mast, /delete root\.dataset\.pageOwnsChrome/, "and gives it back on unmount");
  // Only the full-width reference mast is an application header.
  assert.match(mast, /refMode \? claimShellChrome\(el\)/);
});

test("the shell exposes that marker and nothing more", () => {
  assert.match(read(SHELL), /data-dashboard-shell-root/);
});

test("the suppression is scoped to the marker, so other modules keep their header", () => {
  const css = read(WORKSPACE_CSS).replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = css.slice(css.indexOf("[data-dashboard-shell-root]"));
  assert.match(
    rule,
    /\[data-dashboard-shell-root\]\[data-page-owns-chrome="true"\] > header/,
    "Discovery, Shortlists and Quotations carry no such marker"
  );
  // The mobile header is the only navigation at that width.
  assert.match(css.slice(0, css.indexOf("[data-dashboard-shell-root]")).slice(-200) + rule, /min-width: 768px/);
});

// ---------------------------------------------------------------------------
// The real logo, and no UUID.

test("the mast renders the application's own logo component", () => {
  const mast = read(MAST);
  assert.match(mast, /import \{ ThinkwayLogo \} from "@\/components\/brand\/thinkway-logo"/);
  assert.match(mast, /<ThinkwayLogo compact showText/);
  // Nothing redrawn: the hand-built mark and text wordmark are gone.
  assert.doesNotMatch(mast, /THINK<em>WAY<\/em>/);
  assert.doesNotMatch(mast, /mastMark|mastWord/);
});

test("the canonical logo component is untouched and still shared", () => {
  assert.match(read("components/brand/thinkway-logo.tsx"), /login-v2-logo-mark/);
  for (const shell of [SHELL, "components/layout/portal-shell.tsx"]) {
    assert.match(read(shell), /ThinkwayLogo/, shell);
  }
});

test("a campaign UUID is never shown as a campaign code", () => {
  assert.equal(resolveDisplayCampaignCode("20ae6f6e-2df4-4c1a-9b77-1f2e3d4c5b6a"), undefined);
  assert.equal(resolveDisplayCampaignCode("20AE6F6E-2DF4-4C1A-9B77-1F2E3D4C5B6A"), undefined);
});

test("a real campaign code is shown", () => {
  assert.equal(resolveDisplayCampaignCode("TW-2026-0124"), "TW-2026-0124");
  assert.equal(resolveDisplayCampaignCode("  TW-2026-0124  "), "TW-2026-0124");
});

test("no code at all shows nothing, rather than inventing one", () => {
  assert.equal(resolveDisplayCampaignCode(undefined), undefined);
  assert.equal(resolveDisplayCampaignCode("   "), undefined);
});

test("the panel no longer slices the object id into the mast", () => {
  const panel = read(PANEL);
  assert.match(panel, /campaignCode=\{resolveDisplayCampaignCode\(campaignObjectId\)\}/);
  assert.doesNotMatch(panel, /campaignCode=\{campaignObjectId\?\.slice/);
});

test("the mast keeps the campaign's identity and every control", () => {
  const mast = read(MAST);
  for (const token of ["mastId", "mastSub", "mastStatus", "mastActions", "mastBtn"]) {
    assert.match(mast, new RegExp(`STUDIO_REF_CLASSES\\.${token}`), token);
  }
  assert.match(mast, /\{metaTitle\}/, "campaign identity");
  assert.match(mast, /Review · \{reviewCount\}/, "Review");
  assert.match(mast, /\{mastExtras\}/, "New Campaign / Campaign History ride here");
  assert.match(mast, /CampaignProposalExportActions/);
  assert.match(mast, /<ProgressRing/, "readiness");
});

// ---------------------------------------------------------------------------
// One readiness authority reaches the mast.

test("the mast does not compute readiness itself", () => {
  const mast = read(MAST);
  assert.match(mast, /readiness: StudioReadinessStatus/);
  assert.match(mast, /\{readiness\.summary\}/);
  assert.doesNotMatch(mast, /resolveStudioReadinessLabel/, "the 75% relabelling is gone");
  assert.doesNotMatch(mast, /percent >= 75/);
});

test("no second readiness label function survives", () => {
  assert.doesNotMatch(
    read("features/campaign-studio/services/section-data-resolver.ts"),
    /resolveStudioReadinessLabel/
  );
});

// ---------------------------------------------------------------------------
// What must not have changed (issues 9-12).

test("the shortfall states the requested count, and does not rewrite it", () => {
  // Stated once, in the Creators header, from the Strategy quantity against
  // slate membership. The recommendations list used to compute a second one
  // over a different pair of numbers and phrase it identically.
  const header = read("features/campaign-studio/components/workspace/creators-mix-header.tsx");
  assert.match(header, /resolveStudioCreatorShortfall\(\{\s*requestedCount: required,\s*recommendedCount: qualified,/);
  assert.match(header, /shortfall\.summary/);
  assert.doesNotMatch(read(CARDS), /resolveStudioCreatorShortfall/);
});

test("an alternative never inherits a campaign slate position", () => {
  const cards = read(CARDS);
  assert.ok((cards.match(/rank: undefined/g) ?? []).length >= 2, "alternatives and review both drop it");
  assert.match(cards, /partitionStudioCreatorGroups/);
});

test("Platform Score stays out of selection and ordering", () => {
  const cards = read(CARDS);
  assert.match(cards, /studioCreatorRankingScore/);
  assert.doesNotMatch(cards, /platformScore/i);
  const requirements = read("features/campaign-studio/services/studio-creator-requirements.ts");
  assert.match(requirements, /forRanking/, "the platform row is skipped for ranking");
});

test("Discovery search, ranking, filters and Build Shortlist are untouched by Studio", () => {
  const cards = read(CARDS);
  // Studio consumes Discovery; it does not re-rank or re-filter it.
  assert.doesNotMatch(cards, /rankCreatorsByCampaignRelevance|scoreCreatorCampaignRelevance/);
  assert.match(cards, /ShortlistSlateActions/, "Build Shortlist's entry point is still rendered");
});

test("the creator detail architecture from the earlier fixes is intact", () => {
  const host = read("features/campaign-studio/components/sections/studio-creator-detail-host.tsx");
  assert.equal((host.match(/<CreatorDetailSheet\b/g) ?? []).length, 1);
  assert.match(host, /presentation="discoveryPack"/);
  assert.match(host, /pendingIdentity/);
  assert.match(host, /getUnifiedCreatorsBatchAction/, "the same resolver Discovery uses");
  assert.doesNotMatch(host, /StudioPlanningCreatorDetail/);

  // The scoped CSS scroll/avatar fix is still in place.
  const css = read("app/styles/discovery-suite-creator-profile.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /min-height:\s*0/);
  const pack = read("features/discovery/components/design-system/discovery-suite-creator-profile.tsx");
  assert.match(pack, /@\/app\/styles\/discovery\.css/);
});

test("ECI calculations are consumed, never recomputed, by Studio", () => {
  const projection = read("features/campaign-studio/services/eci/project-studio-eci-signal.ts");
  assert.match(projection, /Studio never owns intelligence/);
  // The campaign decision reads the signal; it does not recompute a score.
  const decision = read("features/campaign-studio/services/studio-campaign-creator-decision.ts");
  assert.doesNotMatch(decision, /investmentScore\s*[*+/-]/);
  assert.match(decision, /supportingSignal/);
});
