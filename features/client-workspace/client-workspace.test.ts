import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { canCreateClientReview, resolveStudioPackageReadiness } from "@/features/campaign-studio/services/studio-package-readiness";
import { isPublicPath } from "@/lib/auth/routes";
import { classifyPagePath } from "@/lib/security/workspace-classify";

import { CLIENT_CHANGE_AREAS, CLIENT_REVIEW_SOURCES } from "./constants";
import { clientSafeFitCopy, formatCompactCount, formatEngagementPct } from "./format";
import { deliverablesLabel } from "./deliverables";
import { HYPEAUDITOR_MEDIA_PLAN_PARITY } from "./hypeauditor-parity";
import { projectMediaPlanSummary } from "./media-plan-summary";
import { briefFromSnapshotCreator } from "./creator-brief";
import { shortlistReviewBlockers, quotationReviewBlockers } from "./source-readiness";
import {
  projectCommercialFromSnapshot,
  parseSourceSnapshot,
} from "./snapshot";
import { visibleClientWorkspaceSections, defaultClientWorkspaceSection } from "./visible-sections";
import {
  clientPackageFingerprintsMatch,
  clientCreatorIds,
  packageFingerprintFromObject,
  projectClientCommercial,
  projectClientCreators,
  projectClientOverview,
  projectClientTimeline,
} from "./project-client-view";
import {
  hashClientReviewToken as hashToken,
  parseReviewCookie,
  buildReviewCookieValue,
  clientReviewTokenHashesEqual,
} from "./security/review-token";
import {
  actionRequiredFor,
  clientSelectionToShortlistStatus,
  countSelections,
  isInteractiveClientReview,
  shortlistStatusToClient,
} from "./status";

test("public review path does not require login", () => {
  assert.equal(isPublicPath("/review"), true);
  assert.equal(isPublicPath("/review/abc/creators"), true);
  assert.equal(classifyPagePath("/review/abc"), "public");
  assert.equal(classifyPagePath("/review/abc/creators"), "public");
});

test("token hashing is md5 like IO approval tokens", () => {
  const token = "a".repeat(32);
  assert.equal(hashToken(token).length, 32);
  assert.equal(clientReviewTokenHashesEqual(hashToken(token), hashToken(token)), true);
  assert.equal(clientReviewTokenHashesEqual(hashToken(token), hashToken("b".repeat(32))), false);
});

test("client-safe fit copy strips internal diagnostics", () => {
  assert.equal(
    clientSafeFitCopy("Strong audience alignment with Egyptian consumers. ECI score 91."),
    "Strong audience alignment with Egyptian consumers."
  );
});

test("review cookie is scoped to a single review id", () => {
  const value = buildReviewCookieValue("review-1", "t".repeat(16));
  assert.deepEqual(parseReviewCookie(value), { reviewId: "review-1", token: "t".repeat(16) });
  assert.equal(parseReviewCookie("nope"), null);
});

test("client projection hides internal scoring language", () => {
  const object = buildCampaignObjectFixture();
  const cards = projectClientCreators(object, {});
  assert.ok(cards.length >= 4);
  assert.equal(cards.every((card) => !/ECI|Apify|fingerprint/i.test(card.fitExplanation ?? "")), true);
  const overview = projectClientOverview(object, {});
  assert.equal(overview.brandName, "Acme");
  assert.match(overview.campaignName, /awareness|summer|Campaign/i);
  assert.doesNotMatch(overview.whyThisApproach, /Apify|fingerprint graph/i);
});

test("commercial totals scale with accepted creators and never invent margin", () => {
  const object = buildCampaignObjectFixture();
  const ids = clientCreatorIds(object);
  const all = Object.fromEntries(ids.map((id) => [id, "in_review" as const]));
  const full = projectClientCommercial(object, all);
  assert.equal(full.currency, "EGP");
  assert.equal(full.totalCount, ids.length);
  assert.equal(full.totalInvestment, 2_000_000);
  assert.equal(full.lines.some((line) => /margin|gp/i.test(line.label)), false);

  const rejectedOne = { ...all, [ids[0]!]: "rejected" as const };
  const reduced = projectClientCommercial(object, rejectedOne);
  assert.ok(reduced.totalInvestment < full.totalInvestment);
  assert.equal(reduced.selectedCount, ids.length - 1);
});

test("timeline duration comes from campaign facts", () => {
  const timeline = projectClientTimeline(buildCampaignObjectFixture());
  assert.equal(timeline.durationWeeks, 6);
  assert.equal(timeline.durationLabel, "6 weeks");
  assert.equal(timeline.phases.length, 6);
});

test("selection maps onto existing shortlist item statuses", () => {
  assert.equal(clientSelectionToShortlistStatus("accepted"), "approved");
  assert.equal(clientSelectionToShortlistStatus("rejected"), "rejected");
  assert.equal(clientSelectionToShortlistStatus("in_review"), "under_review");
  assert.equal(shortlistStatusToClient("approved"), "accepted");
  assert.equal(shortlistStatusToClient("moved_to_campaign"), "accepted");
  const counts = countSelections({ a: "accepted", b: "rejected", c: "in_review" }, ["a", "b", "c"]);
  assert.deepEqual(counts, { accepted: 1, rejected: 1, inReview: 1, total: 3 });
});

test("version fingerprints detect a budget change without mutating v1", () => {
  const v1 = buildCampaignObjectFixture();
  const frozen = packageFingerprintFromObject(v1);
  const v2 = buildCampaignObjectFixture({
    facts: { budget: { amount: 3_000_000, currency: "EGP" } },
  });
  const live = packageFingerprintFromObject(v2);
  assert.equal(clientPackageFingerprintsMatch(frozen, frozen), true);
  assert.equal(clientPackageFingerprintsMatch(frozen, live), false);
});

test("approval is version-bound: superseded reviews are not interactive", () => {
  assert.equal(isInteractiveClientReview("awaiting_review"), true);
  assert.equal(isInteractiveClientReview("approved"), false);
  assert.equal(isInteractiveClientReview("superseded"), false);
  assert.match(actionRequiredFor("superseded", true), /new version/i);
});

test("create client review remains blocked until package readiness is READY FOR CLIENT", () => {
  const blocked = resolveStudioPackageReadiness(buildCampaignObjectFixture());
  assert.equal(canCreateClientReview(blocked), false);
  assert.ok(blocked.clientReviewBlockers.length > 0);
});

test("change-request areas stay structured", () => {
  assert.deepEqual(CLIENT_CHANGE_AREAS, ["creator", "content", "commercial", "campaign"]);
});

test("studio, shortlist, and quotation are the same Client Review sources", () => {
  assert.deepEqual(CLIENT_REVIEW_SOURCES, ["studio", "shortlist", "quotation"]);
});

test("shortlist readiness does not require a Studio strategy", () => {
  const ready = shortlistReviewBlockers({
    header: { status: "draft", is_archived: false, name: "Summer slate" },
    clientLabel: "Acme Legal",
    brandName: "Acme",
    items: [{ id: "item-1", item_status: "draft" }],
    selectedItemIds: ["item-1"],
  });
  assert.deepEqual(ready, []);

  const empty = shortlistReviewBlockers({
    header: { status: "draft", is_archived: false, name: "Summer slate" },
    clientLabel: "Acme Legal",
    brandName: "Acme",
    items: [],
  });
  assert.ok(empty.some((blocker) => /creator/i.test(blocker)));

  const archived = shortlistReviewBlockers({
    header: { status: "approved", is_archived: true, name: "Old" },
    clientLabel: "Acme",
    brandName: "Acme",
    items: [{ id: "item-1", item_status: "draft" }],
  });
  assert.ok(archived.some((blocker) => /archived/i.test(blocker)));
});

test("quotation readiness requires a current quotation, not a Studio rebuild", () => {
  const base = {
    status: "draft" as const,
    is_archived: false,
    is_expired: false,
    client_name: "Acme Legal",
    brand_name: "Acme",
    name: "Q-1",
    items: [
      {
        id: "qi-1",
        influencer_id: "inf-1",
        profile_id: null,
        unified_id: null,
        source_shortlist_item_id: null,
        creator_name: "Creator A",
        platform: "instagram",
        handle: "@a",
        followers: 1000,
        engagement_rate: 2,
        country_code: "EG",
        deliverables: [],
        profile_image_url: null,
        profile_url: null,
        option_number: 1,
        service_description: null,
        commercial_input_mode: "cost_gp_pct" as const,
        cost: 0,
        cost_currency: "EGP",
        revenue: 50_000,
        gp_pct: 0,
        gp_value: 0,
        fx_rate_to_egp: 1,
        cost_egp: 0,
        revenue_egp: 50_000,
        gp_value_egp: 0,
        af_pct: 0,
        af_value: 0,
        af_value_egp: 0,
        sort_order: 0,
        collapse_group_id: null,
        collapse_label: null,
      },
    ],
  };
  assert.deepEqual(quotationReviewBlockers(base), []);
  assert.ok(
    quotationReviewBlockers({ ...base, status: "cancelled" }).some((blocker) => /current/i.test(blocker))
  );
  assert.ok(
    quotationReviewBlockers({ ...base, is_expired: true }).some((blocker) => /expired/i.test(blocker))
  );
  assert.ok(
    quotationReviewBlockers({ ...base, items: [] }).some((blocker) => /items/i.test(blocker))
  );
});

test("frozen snapshot commercial uses per-creator quotation values, not a second engine", () => {
  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [
      { creatorId: "a", displayName: "A", investmentAmount: 40_000, investmentCurrency: "EGP" },
      { creatorId: "b", displayName: "B", investmentAmount: 60_000, investmentCurrency: "EGP" },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 100_000,
      totalInvestment: 100_000,
      lines: [],
      selectedCount: 2,
      totalCount: 2,
    },
    quotation: {
      id: "q1",
      serialNumber: "QT-1",
      name: "Summer",
      version: "1.0",
      lines: [
        { creatorId: "a", label: "A", amount: 40_000 },
        { creatorId: "b", label: "B", amount: 60_000 },
      ],
    },
    creatorIds: ["a", "b"],
  });
  assert.ok(snapshot);
  const full = projectCommercialFromSnapshot(snapshot!, { a: "in_review", b: "in_review" });
  assert.equal(full.totalInvestment, 100_000);
  const reduced = projectCommercialFromSnapshot(snapshot!, { a: "rejected", b: "accepted" });
  assert.equal(reduced.totalInvestment, 60_000);
  assert.equal(reduced.selectedCount, 1);
});

test("client nav hides empty sections by source", () => {
  const shortlistView = {
    review: { source: "shortlist" as const },
    creators: [{ creatorId: "a" }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 0, totalInvestment: 0, lines: [], selectedCount: 0, totalCount: 0 },
    quotation: undefined,
    strategyBody: undefined,
  };
  assert.deepEqual(visibleClientWorkspaceSections(shortlistView as never), [
    "overview",
    "creators",
    "feedback",
    "approval",
  ]);

  const quotationView = {
    review: { source: "quotation" as const },
    creators: [{ creatorId: "a" }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 10, totalInvestment: 10, lines: [], selectedCount: 1, totalCount: 1 },
    quotation: { id: "q1", serialNumber: "QT-1", name: "Q", version: "1", lines: [] },
    strategyBody: undefined,
  };
  assert.deepEqual(visibleClientWorkspaceSections(quotationView as never), [
    "overview",
    "creators",
    "commercial",
    "quotation",
    "feedback",
    "approval",
  ]);

  const studioView = {
    review: { source: "studio" as const },
    creators: [{ creatorId: "a" }],
    content: [{ creatorName: "A", platform: "instagram", deliverable: "Reel" }],
    timeline: { durationWeeks: 6, durationLabel: "6 weeks", phases: [{ week: 1, label: "Prep", activities: [] }] },
    commercial: { currency: "EGP", creatorInvestment: 10, totalInvestment: 10, lines: [], selectedCount: 1, totalCount: 1 },
    quotation: undefined,
    strategyBody: "Reach urban Egypt.",
  };
  assert.deepEqual(visibleClientWorkspaceSections(studioView as never), [
    "overview",
    "strategy",
    "creators",
    "content",
    "commercial",
    "timeline",
    "feedback",
    "approval",
  ]);
  assert.equal(defaultClientWorkspaceSection(["overview", "commercial", "feedback"]), "commercial");
});

test("legacy snapshots still parse after media-plan fields are added", () => {
  const snapshot = parseSourceSnapshot({
    source: "shortlist",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: [],
    creators: [{ creatorId: "a", displayName: "A", followers: 12000, engagementRate: 4.8 }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 0,
      totalInvestment: 0,
      lines: [],
      selectedCount: 1,
      totalCount: 1,
    },
    creatorIds: ["a"],
  });
  assert.ok(snapshot);
  assert.equal(snapshot!.creators[0]?.followers, 12_000);
  assert.equal(snapshot!.creators[0]?.contentFeed, undefined);
  assert.equal(snapshot!.mediaPlanSummary, undefined);
});

test("campaign summary uses forecast + client investment and never fabricates EMV or ROI", () => {
  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [
      {
        creatorId: "a",
        displayName: "A",
        followers: 80_000,
        engagementRate: 3.2,
        platform: "instagram",
        investmentAmount: 40_000,
        deliverableItems: [{ platform: "instagram", type: "Reel", quantity: 1 }],
      },
      {
        creatorId: "b",
        displayName: "B",
        followers: 50_000,
        engagementRate: 4.1,
        platform: "instagram",
        investmentAmount: 60_000,
        deliverableItems: [{ platform: "instagram", type: "Story", quantity: 2 }],
      },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 100_000,
      totalInvestment: 100_000,
      lines: [],
      selectedCount: 2,
      totalCount: 2,
    },
    creatorIds: ["a", "b"],
  });
  assert.ok(snapshot);
  const full = projectMediaPlanSummary(snapshot!, { a: "in_review", b: "in_review" });
  assert.equal(full.creatorCount, 2);
  assert.ok(full.estimatedReach != null && full.estimatedReach > 0);
  assert.ok(full.estimatedEngagements != null && full.estimatedEngagements > 0);
  assert.ok(full.cpe != null && full.cpe > 0);
  assert.ok(full.cpm != null && full.cpm > 0);
  assert.equal(full.emv, undefined);
  assert.ok(full.activityMix.some((item) => /Reel/i.test(item.label)));

  const reduced = projectMediaPlanSummary(snapshot!, { a: "rejected", b: "accepted" });
  assert.equal(reduced.creatorCount, 1);
  assert.ok(reduced.estimatedReach != null && reduced.estimatedReach < (full.estimatedReach ?? 0));
});

test("campaign summary omits reach when follower data is unavailable", () => {
  const snapshot = parseSourceSnapshot({
    source: "shortlist",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: [],
    deliverables: [],
    creators: [{ creatorId: "a", displayName: "A" }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 0,
      totalInvestment: 0,
      lines: [],
      selectedCount: 1,
      totalCount: 1,
    },
    creatorIds: ["a"],
  });
  const summary = projectMediaPlanSummary(snapshot!, { a: "in_review" });
  assert.equal(summary.estimatedReach, undefined);
  assert.equal(summary.cpe, undefined);
  assert.equal(summary.cpm, undefined);
  assert.equal(summary.emv, undefined);
});

test("unavailable metrics stay unknown and real zeros stay zero", () => {
  assert.equal(formatCompactCount(undefined), "Not available");
  assert.equal(formatCompactCount(0), "0");
  assert.equal(formatEngagementPct(undefined), "Not available");
  assert.equal(deliverablesLabel(undefined), "Deliverables to be confirmed");
  assert.match(deliverablesLabel([{ platform: "instagram", type: "Reel", quantity: 1 }]), /Reel/);
});

test("frozen creator brief is projected from snapshot without inventing audience", () => {
  const brief = briefFromSnapshotCreator({
    creatorId: "a",
    displayName: "A",
    followers: 10_000,
    avgLikes: 0,
  });
  assert.equal(brief.audience, null);
  assert.equal(brief.performance?.avgLikes, 0);
  assert.equal(brief.contentFeed.length, 0);
  assert.equal(brief.frozen, false);
});

test("HypeAuditor parity matrix covers the required media-plan capabilities", () => {
  const required = [
    "Campaign summary",
    "Creator cards",
    "Creator detail",
    "Audience",
    "Performance",
    "Content feed",
    "Deliverables",
    "Commercial",
    "Creator selection",
    "Filters",
    "Comments",
    "Approval",
    "Versioning",
    "Responsive experience",
  ];
  for (const capability of required) {
    const row = HYPEAUDITOR_MEDIA_PLAN_PARITY.find((item) => item.capability === capability);
    assert.ok(row, capability);
    assert.equal(row!.status, "shipped");
  }
  assert.equal(HYPEAUDITOR_MEDIA_PLAN_PARITY.find((row) => row.capability === "ROI")?.status, "not_copied");
  assert.equal(HYPEAUDITOR_MEDIA_PLAN_PARITY.find((row) => row.capability === "HypeAuditor AQS")?.status, "not_copied");
});

