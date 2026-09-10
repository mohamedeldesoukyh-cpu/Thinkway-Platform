/**
 * The Studio → Creators → Creator Details → Content presentation contract.
 *
 * Browser evidence this pins, symptom by symptom:
 *   - clicking a creator opened a temporary right-side "Executive
 *     recommendation" drawer that was replaced by the canonical pack seconds
 *     later, because the host rendered a DIFFERENT component while
 *     `getUnifiedCreatorsBatchAction` resolved;
 *   - the pack could not be scrolled — its tail was clipped with no scrollbar;
 *   - the campaign screen carried TWO Thinkway headers, the lower one drawing
 *     its own mark instead of the approved logo;
 *   - creator cards printed internal analyst reasoning and a bare confidence
 *     percentage.
 *
 * These are source-contract tests: they read the shipped source and CSS. They
 * do not render, and no browser run is claimed anywhere in this file.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SHEET = "features/campaigns/components/creator-detail-sheet.tsx";
const STUDIO_HOST = "features/campaign-studio/components/sections/studio-creator-detail-host.tsx";
const CARDS = "features/campaign-studio/components/sections/vendor-recommendations-section.tsx";
const STRIP =
  "features/campaign-studio/components/sections/shared/studio-planning-intelligence-strip.tsx";
const MAST = "features/campaign-studio/components/studio-top-chrome.tsx";
const LOGO = "components/brand/thinkway-logo.tsx";
const PACK_OVERRIDES = "app/styles/discovery-suite-creator-profile.css";

function read(file: string): string {
  return readFileSync(file, "utf8");
}

/** CSS with comments removed — a selector named in prose is not a rule. */
function readRules(file: string): string {
  return read(file).replace(/\/\*[\s\S]*?\*\//g, "");
}

// ---------------------------------------------------------------------------
// 1. One component from the first frame. No temporary drawer.

test("the Studio host renders exactly one creator detail component", () => {
  const source = read(STUDIO_HOST);
  const mounts = source.match(/<CreatorDetailSheet\b/g) ?? [];
  assert.equal(mounts.length, 1, "two mounts is how the swap happened");
  assert.match(source, /presentation="discoveryPack"/);
});

test("no second detail component is mounted while the creator resolves", () => {
  const source = read(STUDIO_HOST);
  // The planning sheet was rendered for those seconds and then swapped out.
  assert.doesNotMatch(source, /StudioPlanningCreatorDetail/);
  assert.doesNotMatch(source, /resolveStudioCreatorDetailSource/);
  assert.doesNotMatch(source, /discoveryDetailStateForSource/);
});

test("the loading state lives inside the canonical pack", () => {
  const host = read(STUDIO_HOST);
  assert.match(host, /pendingIdentity/, "the host hands the clicked card's identity through");

  const sheet = read(SHEET);
  const pending = sheet.slice(sheet.indexOf("if (!activeCreator)"));
  assert.match(
    pending.slice(0, 2000),
    /DiscoverySuiteCreatorProfile/,
    "the pending shell is the same pack, not another surface"
  );
  assert.match(pending.slice(0, 2000), /Loading creator profile/);
});

test("the pending shell invents no metrics", () => {
  const sheet = read(SHEET);
  const pending = sheet.slice(sheet.indexOf("if (!activeCreator)"), sheet.indexOf("if (!activeCreator)") + 2000);
  assert.match(pending, /investmentScore=\{null\}/, "no placeholder score");
  assert.match(pending, /platforms=\{\[\]\}/, "no placeholder platforms");
  assert.match(pending, /kvRows=\{\[\]\}/, "no placeholder metric rows");
});

test("the pack is keyed on the creator, so one profile never shows another's data", () => {
  assert.match(read(STUDIO_HOST), /key=\{creator\?\.unified_id \?\? creatorId \?\? "pending"\}/);
});

// ---------------------------------------------------------------------------
// 2. The pack scrolls.

test("the pack's columns may shrink below their content, so the body scrolls", () => {
  const css = readRules(PACK_OVERRIDES);
  // A grid item and a flex item both default to `min-height:auto`, so the
  // middle column grew to its content height and `.tw-cp__b` — which the frozen
  // sheet makes `overflow-y:auto` — never became a scroller.
  const blocks = css.split("}").map((block) => {
    const [selectors = "", body = ""] = block.split("{");
    return {
      selectors: selectors.split(",").map((part) => part.trim()),
      body,
    };
  });
  for (const selector of [".tw-cp__w", ".tw-cp__m", ".tw-cp__b"]) {
    const shrinkable = blocks.some(
      (block) =>
        block.selectors.some((part) => part.endsWith(selector)) &&
        /min-height:\s*0/.test(block.body)
    );
    assert.equal(shrinkable, true, `${selector} must be allowed to shrink`);
  }
});

test("the scroll fix is an override and adds no second scroller", () => {
  const css = readRules(PACK_OVERRIDES);
  const scrollBlock = css.slice(css.indexOf(".tw-cp__w"));
  assert.doesNotMatch(scrollBlock, /max-height/, "geometry stays in the frozen sheet");
  assert.doesNotMatch(scrollBlock, /overflow-y:\s*auto/, "no new scroller is introduced");
});

test("every override rule stays scoped to the pack", () => {
  const css = read(PACK_OVERRIDES);
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .map((block) => block.split("{")[0]?.trim())
    .filter((selector): selector is string => Boolean(selector) && !selector.startsWith("@"));
  for (const selector of selectors) {
    for (const part of selector.split(",")) {
      assert.match(
        part.trim(),
        /^\.discovery-suite\b/,
        `unscoped rule would leak to every route: ${part.trim()}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 3. One Thinkway header, with the approved logo.

test("the campaign mast draws no brand lockup of its own", () => {
  const source = read(MAST);
  // A hand-built mark plus a text wordmark, stacked under the app header that
  // already carries the canonical logo.
  assert.doesNotMatch(source, /THINK<em>WAY<\/em>/);
  assert.doesNotMatch(source, /mastMark|mastWord/);
});

test("the campaign mast still carries the campaign's identity", () => {
  const source = read(MAST);
  for (const token of ["mastId", "mastSub", "mastStatus"]) {
    assert.match(source, new RegExp(`STUDIO_REF_CLASSES\\.${token}`), token);
  }
  assert.match(source, /\{metaTitle\}/);
});

test("the canonical logo component is the app's, unchanged and reused", () => {
  const logo = read(LOGO);
  assert.match(logo, /login-v2-logo-mark/, "the approved asset, not a redrawn one");
  for (const shell of [
    "components/layout/dashboard-shell.tsx",
    "components/layout/portal-shell.tsx",
  ]) {
    assert.match(read(shell), /ThinkwayLogo/, `${shell} still renders the canonical logo`);
  }
});

test("Studio reuses the canonical logo and reimplements nothing", () => {
  const mast = read(MAST);
  // Updated deliberately. This used to require NO logo in the mast at all,
  // because the mast then sat under the global Thinkway header. The Studio
  // route no longer renders that header — the campaign mast is the first
  // application header, as on the Shortlist and Quotation workspaces — so the
  // approved component belongs here. What must never come back is a redrawn
  // one: no wordmark text node, no hand-built mark.
  assert.match(mast, /<ThinkwayLogo compact showText/);
  assert.doesNotMatch(mast, />\s*THINK/);
  assert.doesNotMatch(mast, /mastMark|mastWord/);

  // And nothing in Studio redefines the approved logo's own classes.
  const studioCss = readRules("features/campaign-studio/styles/campaign-studio-ref.css");
  assert.doesNotMatch(studioCss, /login-v2-logo/);
});

// ---------------------------------------------------------------------------
// 4. Cards speak to the client; the analyst layer stays in the detail.

test("cards do not print the ECI signal's raw sentence", () => {
  const source = read(CARDS);
  // It reached the card two ways: rendered directly, and seeded into the
  // rationale that `resolveVendorGrounding` falls back to.
  assert.doesNotMatch(
    source,
    /Why:<\/b>\s*\{vendor\.planningSignal/,
    "the raw analyst sentence was the card's Why line"
  );
  assert.doesNotMatch(
    source,
    /rationale:\s*\n?\s*vendor\.planningSignal\?\.why/,
    "and it seeded the rationale the Why line falls back to"
  );
  // The card's Why is now the decision's own sentence, with the campaign's
  // rationale carried inside that object as its leading evidence — one Why per
  // card, from one source.
  assert.match(source, /<b>Why:<\/b> \{campaignDecision\.why\}/);
  assert.match(source, /slateRationale: clientSafeLine\(grounding\.whySelected\)/);
});

test("cards do not print a raw confidence percentage", () => {
  const source = read(CARDS);
  assert.doesNotMatch(
    source,
    /Confidence:\{" "\}/,
    "a bare percentage is an internal reliability reading"
  );
  assert.doesNotMatch(source, /eciConfidencePercent \?\?\s*$/m);
});

test("the card's decision comes from one authoritative object", () => {
  const strip = read(STRIP);
  // Updated deliberately. The strip used to derive its own label from the
  // card's GROUP plus the ECI signal. Both the group and the card now read one
  // `CampaignCreatorDecision`, so a heading and a card cannot disagree.
  assert.match(strip, /decision: CampaignCreatorDecision/);
  assert.match(strip, /\{decision\.label\}/);
  assert.match(strip, /\{decision\.why\}/);
  assert.match(strip, /decision\.evidence/);
  assert.match(strip, /Supporting intelligence/, "ECI is labelled as support");
  // The raw narrative and the confidence chip were rendered inline here.
  assert.doesNotMatch(strip, /StudioRecommendationNarrative/);
  assert.doesNotMatch(strip, /confidencePercent/);
});

test("every card strip renders that same decision object", () => {
  const source = read(CARDS);
  const strips = source.match(/<StudioPlanningIntelligenceStrip[\s\S]{0,220}?\/>/g) ?? [];
  assert.ok(strips.length >= 1, "no card strip found");
  for (const strip of strips) {
    assert.match(strip, /decision=\{campaignDecision\}/, strip);
  }
  // And the group a card sits in is derived from the same decision.
  assert.match(source, /decision\.status === "recommended"/);
});

test("the analyst narrative is still reachable, in the detail's Campaign tab", () => {
  // This is a presentation boundary, not a deletion of ECI.
  assert.match(read(STUDIO_HOST), /StudioExecutiveRecommendationBlock/);
  assert.match(read(SHEET), /contextSlot/);
});

// ---------------------------------------------------------------------------
// 5. What must not have changed.

test("the three card groups come from one partition of the hydrated pool", () => {
  const source = read(CARDS);
  assert.match(source, /partitionStudioCreatorGroups/);
  assert.match(source, /creatorGroups\.selected/);
  assert.match(source, /creatorGroups\.needsReview/);
  assert.match(source, /creatorGroups\.alternatives/);
});

test("the shortfall is stated, never absorbed by the alternatives group", () => {
  const source = read(CARDS);
  assert.match(source, /resolveStudioCreatorShortfall/);
  assert.match(source, /slateShortfall\.summary/);
});

test("a pool position is never shown as a slate number", () => {
  const source = read(CARDS);
  // Ranks 1..10 then 16 came from rendering pool positions in the same list as
  // the slate's contiguous ones.
  const rankStrips = source.match(/rank: undefined/g) ?? [];
  assert.ok(rankStrips.length >= 2, "alternatives and review groups both drop the pool rank");
});

test("Platform Score orders nothing on the recommendation list", () => {
  const source = read(CARDS);
  assert.match(source, /studioCreatorRankingScore/);
  assert.doesNotMatch(source, /sortByStudioRequirements\([^)]*platformScore/);
});

test("add, remove and replace are still wired to their existing flows", () => {
  const source = read(CARDS);
  for (const token of ["replacementCandidates", "campaignBrowseFilters", "AddCreatorPanel"]) {
    assert.match(source, new RegExp(token), token);
  }
});

test("Build Shortlist is untouched", () => {
  const source = read(CARDS);
  assert.match(source, /ShortlistSlateActions/, "the existing entry point is still rendered");
});
