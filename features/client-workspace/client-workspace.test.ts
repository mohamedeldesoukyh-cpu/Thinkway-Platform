import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { canCreateClientReview, resolveStudioPackageReadiness } from "@/features/campaign-studio/services/studio-package-readiness";
import { isPublicPath } from "@/lib/auth/routes";
import { classifyApiPath, classifyPagePath } from "@/lib/security/workspace-classify";

import { CLIENT_CHANGE_AREAS, CLIENT_REVIEW_LINK_MISSING_MESSAGE, CLIENT_REVIEW_SOURCES, CLIENT_WORKSPACE_JOURNEY_SECTIONS, CLIENT_WORKSPACE_SECTION_LABEL } from "./constants";
import {
  clientSelectionsEqual,
  defaultQuotationClientSelection,
  mergePersistedClientSelection,
  quotationClientShareRequiresSave,
  quotationIsMovedToCampaign,
} from "./client-review-selection";
import { clientSafeFitCopy, clientCreatorIdentity, clientCreatorCardDescription, formatCompactCount, formatEngagementPct, formatEngagementRateLabel, formatHandleLabel, formatOptionalCompactCount, formatOptionalEngagementPct, listPlatformChipMetrics, providedText } from "./format";
import { deliverablesLabel, groupedActivityMix, looksLikePlatformList, summarizeCreatorDeliverables, summarizeDeliverablesByPlatform } from "./deliverables";
import {
  allocationSlices,
  containsInternalTerminology,
  creatorMixFromRoster,
  qualityBadge,
  qualityGaugePercent,
  engagementBadge,
  engagementGaugePercent,
  estimatedReachInsight,
  levelMeterActiveSegment,
  rosterHeadline,
  rosterSourceLine,
  strategicPillars,
} from "./presentation";
import { acceptedCreators, contentRowsForSelection, yourSelectionRoster } from "./selection-view";
import { HYPEAUDITOR_MEDIA_PLAN_PARITY } from "./hypeauditor-parity";
import { projectMediaPlanSummary, projectSelectionSummaryFromCards } from "./media-plan-summary";
import { briefFromSnapshotCreator, mergeFrozenBrief, needsClientBriefBackfill } from "./creator-brief";
import { enrichSnapshotCreatorFromUnified, mixPostsForDeliverables, profileUrlFromHandle, resolveContentPostPlatform, shouldReplaceContentFeed } from "./creator-snapshot";
import { creatorPlatformBreakdown, creatorProfileLinks, engagementMetersForBreakdown, avatarProfileUrlForReview } from "./platform-breakdown";
import { clientReviewAvatarUrl, isReviewMediaUrlAllowed, reviewMediaAllowlist } from "./review-media";
import { canCreateCampaignFromQuotation } from "@/lib/commercial-sync/rules";
import { diffClientReviewSnapshots, diffShortlistToQuotation, retainCreatorBriefs } from "./snapshot-diff";
import {
  canLiveSyncClientReview,
  clientApprovalSideEffects,
  deriveQuotationStage,
  deriveShortlistStage,
  isReusableClientReviewTip,
  journeyActionRequired,
  journeyCanonicalReviewId,
  pickActiveDecisionReview,
  projectClientJourney,
  reviewIdBelongsToJourney,
  approvalWorkspaceKind,
  canMutateClientReviewFromBoundReview,
  clientWorkspacePathReviewId,
  clientWorkspaceVersionPill,
  QUOTATION_STAGE_LABEL,
  snapshotForReview,
} from "./journey-state";
import {
  actionRequiredFor,
  clientSelectionToShortlistStatus,
  countSelections,
  isFrozenClientReviewStatus,
  isInteractiveClientReview,
  isSelectedForCalculator,
  nextAcceptState,
  shortlistStatusToClient,
} from "./status";
import {
  projectCommercialFromSnapshot,
  parseSourceSnapshot,
  parseSnapshotCreator,
  visibleClientUpdateNotice,
  fingerprintFromSnapshotCreators,
} from "./snapshot";
import {
  canApproveFinalQuotation,
  canConfirmCreators,
  campaignStageCopy,
  clientFacingObjectIsSafe,
  clientStatusDisplay,
  commercialStageCopy,
  confirmCreatorsDoesNotApproveQuotation,
  consolidationContract,
  isPricedClientInvestment,
  isValidClientCommercialApproval,
  mergeSnapshotsForClientView,
  overlayQuotationOnShortlistCreators,
  selectionCalculator,
  selectionChangeAllowed,
  selectionJourneyFlags,
  thinkwayStatusFromInternal,
  CONFIRM_CREATORS_LABEL,
  APPROVE_SELECTED_CREATORS_LABEL,
  APPROVE_FINAL_QUOTATION_LABEL,
  REVIEW_YOUR_SELECTION_LABEL,
  CLIENT_APPROVED_LABEL,
  PRICE_PENDING_LABEL,
  investmentDisplayLabel,
  canEnableApproveSelectedCreators,
  thinkwayStatusLabel,
  creatorsForClientCommercial,
  headerSelectionNavigation,
  primaryActionForJourney,
  shortlistCreatorSelectEnabled,
  AFTER_CREATOR_APPROVAL_SECTION,
  UNPRICED_INCLUDED_MESSAGE,
  canOpenCommercialWorkspace,
  buildCreatorApprovalConfirmation,
  selectAllCreatorStates,
  clearCreatorSelectionStates,
} from "./selection-flow";
import {
  clientFacingAgencyFeeFromLine,
  clientFacingQuotationPrice,
  convertLineRevenueToQuotationCurrency,
  originalInvestmentForDisplay,
} from "./quotation-client-facing";
import { overlayQuotationDetailOnCreators, clientServiceDescriptionFromQuotationItem } from "./quotation-client-overlay";
import { normalizeClientDeliveryEmail } from "./client-quotation-delivery";
import {
  isRenderableClientWorkspaceSection,
  resolveClientWorkspaceSection,
  visibleClientWorkspaceSections,
  defaultClientWorkspaceSection,
} from "./visible-sections";
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
import { shortlistReviewBlockers, quotationReviewBlockers } from "./source-readiness";
import {
  brandDomainGuess,
  brandMentionsInsight,
  brandSocialHandle,
  isKnownBrandDomain,
  isLikelyWebsiteDomain,
  normalizeBrandMentions,
} from "./brand-mentions";
import {
  brandLogoClientSources,
  brandLogoServerSources,
  clientReviewBrandLogoPath,
  reviewBrandMentionAllowed,
} from "./brand-logo";
import {
  categoryFamily,
  contentCategoriesForDisplay,
  contentCategoriesFromShares,
  isDisplayableCategory,
  listCreatorCategoryStickers,
} from "./content-categories";

test("public review path does not require login", () => {
  assert.equal(isPublicPath("/review"), true);
  assert.equal(isPublicPath("/review/abc/creators"), true);
  assert.equal(isPublicPath("/api/review/media"), true);
  assert.equal(isPublicPath("/api/review/brand-logo"), true);
  assert.equal(classifyPagePath("/review/abc"), "public");
  assert.equal(classifyPagePath("/review/abc/creators"), "public");
  assert.equal(classifyApiPath("/api/review/media"), "public");
  assert.equal(classifyApiPath("/api/review/brand-logo"), "public");
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

test("creator card description prefers quotation service description", () => {
  assert.equal(
    clientCreatorCardDescription({
      serviceDescription: "1× IG Story with boosting",
      bio: "Cairo-based beauty creator covering skincare launches.",
    }),
    "1× IG Story with boosting"
  );
  assert.equal(
    clientCreatorCardDescription({ bio: "Cairo-based beauty creator covering skincare launches." }),
    "Cairo-based beauty creator covering skincare launches."
  );
  assert.equal(
    clientCreatorCardDescription({
      bio: "Lifestyle creator covering beauty and fitness. ECI score 91.",
      fitExplanation: "Should not win when bio exists.",
    }),
    "Lifestyle creator covering beauty and fitness. score 91."
  );
  assert.equal(
    clientCreatorCardDescription({
      fitExplanation: "Strong audience alignment with Egyptian consumers. ECI score 91.",
    }),
    "Strong audience alignment with Egyptian consumers."
  );
  assert.equal(clientCreatorCardDescription({}), undefined);
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
  const none = projectClientCommercial(object, all);
  assert.equal(none.currency, "EGP");
  assert.equal(none.totalCount, ids.length);
  assert.equal(none.quotationTotal, 2_000_000);
  assert.equal(none.totalInvestment, 0);
  assert.equal(none.selectedCount, 0);
  assert.equal(none.lines.some((line) => /margin|gp/i.test(line.label)), false);

  const acceptedOne = { ...all, [ids[0]!]: "accepted" as const };
  const selected = projectClientCommercial(object, acceptedOne);
  assert.ok(selected.totalInvestment > 0);
  assert.ok(selected.totalInvestment < selected.quotationTotal);
  assert.equal(selected.selectedCount, 1);
  assert.equal(selected.quotationTotal, 2_000_000);
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
  assert.equal(shortlistStatusToClient("approved"), "in_review");
  assert.equal(shortlistStatusToClient("moved_to_campaign"), "in_review");
  assert.equal(shortlistStatusToClient("rejected"), "rejected");
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

test("campaign-linked quotations default Client Workspace creators to approved", () => {
  assert.equal(quotationIsMovedToCampaign({ campaign_header_id: "hdr-1", status: "draft" }), true);
  assert.equal(quotationIsMovedToCampaign({ campaign_header_id: null, status: "accepted" }), true);
  assert.equal(quotationIsMovedToCampaign({ campaign_header_id: null, status: "draft" }), false);
  assert.deepEqual(defaultQuotationClientSelection(["a", "b"], true), {
    a: "accepted",
    b: "accepted",
  });
  assert.deepEqual(defaultQuotationClientSelection(["a"], false), { a: "in_review" });
});

test("Show link does not require a save when the quotation already has a link or is in campaign", () => {
  assert.equal(
    quotationClientShareRequiresSave({
      hasUnsavedChanges: true,
      hasExistingLink: true,
      movedToCampaign: false,
    }),
    false
  );
  assert.equal(
    quotationClientShareRequiresSave({
      hasUnsavedChanges: true,
      hasExistingLink: false,
      movedToCampaign: true,
    }),
    false
  );
  assert.equal(
    quotationClientShareRequiresSave({
      hasUnsavedChanges: true,
      hasExistingLink: false,
      movedToCampaign: false,
    }),
    true
  );
  assert.equal(CLIENT_REVIEW_LINK_MISSING_MESSAGE, "Generate the Client Workspace link first.");
});

test("campaign-linked quotation reviews replace previous in-review selection", () => {
  const merged = mergePersistedClientSelection({
    creatorIds: ["a", "b"],
    previous: { a: "in_review", b: "rejected" },
    incoming: { a: "accepted", b: "accepted" },
    replaceSelection: true,
  });
  assert.deepEqual(merged, { a: "accepted", b: "accepted" });
  const preserved = mergePersistedClientSelection({
    creatorIds: ["a", "b"],
    previous: { a: "in_review", b: "rejected" },
    incoming: { a: "accepted", b: "accepted" },
    replaceSelection: false,
  });
  assert.deepEqual(preserved, { a: "in_review", b: "rejected" });
  assert.equal(clientSelectionsEqual({ a: "accepted" }, { a: "accepted" }, ["a"]), true);
  assert.equal(clientSelectionsEqual({ a: "in_review" }, { a: "accepted" }, ["a"]), false);
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
  const empty = projectCommercialFromSnapshot(snapshot!, { a: "in_review", b: "in_review" });
  assert.equal(empty.quotationTotal, 100_000);
  assert.equal(empty.totalInvestment, 0);
  assert.equal(empty.selectedCount, 0);
  const reduced = projectCommercialFromSnapshot(snapshot!, { a: "rejected", b: "accepted" });
  assert.equal(reduced.totalInvestment, 60_000);
  assert.equal(reduced.selectedCount, 1);
  assert.equal(reduced.quotationTotal, 100_000);
});

test("client primary navigation is Shortlist, Your Selection, Commercial, Campaign, Overview", () => {
  const expected = ["shortlist", "creators", "commercial", "approval", "overview"];
  assert.deepEqual([...CLIENT_WORKSPACE_JOURNEY_SECTIONS], expected);
  const shortlistView = {
    review: { source: "shortlist" as const },
    creators: [{ creatorId: "a" }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 0, totalInvestment: 0, lines: [], selectedCount: 0, totalCount: 0 },
    quotation: undefined,
    strategyBody: undefined,
  };
  assert.deepEqual(visibleClientWorkspaceSections(shortlistView as never), expected);

  const quotationView = {
    review: { source: "quotation" as const },
    creators: [{ creatorId: "a" }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 10, totalInvestment: 10, lines: [], selectedCount: 1, totalCount: 1 },
    quotation: { id: "q1", serialNumber: "QT-1", name: "Q", version: "1", lines: [] },
    strategyBody: undefined,
  };
  assert.deepEqual(visibleClientWorkspaceSections(quotationView as never), expected);

  const emptyView = {
    review: { source: "quotation" as const },
    creators: [],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 0, totalInvestment: 0, lines: [], selectedCount: 0, totalCount: 0 },
    quotation: { id: "q1", serialNumber: "QT-1", name: "Q", version: "1", lines: [] },
    strategyBody: undefined,
  };
  assert.deepEqual(visibleClientWorkspaceSections(emptyView as never), expected);
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL.shortlist, "Shortlist");
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL.creators, "Your Selection");
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL.commercial, "Commercial");
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL.approval, "Campaign");
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL.overview, "Overview");
  assert.equal(expected.at(-1), "overview");
  assert.equal(defaultClientWorkspaceSection(expected), "shortlist");
  assert.equal(defaultClientWorkspaceSection(["overview", "creators", "commercial", "approval"]), "overview");
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
  const empty = projectMediaPlanSummary(snapshot!, { a: "in_review", b: "in_review" });
  assert.equal(empty.creatorCount, 0);
  assert.equal(empty.estimatedReach, undefined);
  const full = projectMediaPlanSummary(snapshot!, { a: "accepted", b: "accepted" });
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
  assert.ok(full.creatorForecasts.b?.estimatedReach != null);
});

test("calculator ignores in-review creators until they are accepted", () => {
  assert.equal(isSelectedForCalculator("accepted"), true);
  assert.equal(isSelectedForCalculator("in_review"), false);
  assert.equal(isSelectedForCalculator("rejected"), false);
  const cards = [
    {
      creatorId: "a",
      displayName: "A",
      selection: "accepted" as const,
      investmentAmount: 40_000,
      followers: 80_000,
      engagementRate: 3.2,
      platform: "instagram",
      deliverableItems: [{ platform: "instagram", type: "Reel", quantity: 1 }],
      contentExamples: [],
    },
    {
      creatorId: "b",
      displayName: "B",
      selection: "in_review" as const,
      investmentAmount: 60_000,
      followers: 50_000,
      engagementRate: 4.1,
      platform: "instagram",
      deliverableItems: [{ platform: "instagram", type: "Story", quantity: 2 }],
      contentExamples: [],
    },
  ];
  const summary = projectSelectionSummaryFromCards(
    cards,
    { a: "accepted", b: "in_review" },
    "EGP"
  );
  assert.equal(summary.creatorCount, 1);
  assert.ok(summary.estimatedReach != null && summary.estimatedReach > 0);
  assert.equal(summary.emv, undefined);
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
  assert.equal(deliverablesLabel([{ platform: "instagram", type: "Reel", quantity: 1 }]).includes("Reel"), true);
  assert.equal(looksLikePlatformList("instagram,tiktok,youtube,facebook"), true);
  const collapsed = summarizeCreatorDeliverables([
    { platform: "instagram,tiktok,youtube,facebook", type: "instagram_reel", quantity: 1 },
    { platform: "instagram,tiktok,youtube,facebook", type: "instagram_reel", quantity: 1 },
    { platform: "instagram,tiktok,youtube,facebook", type: "mirrored_ig", quantity: 1 },
  ]);
  assert.deepEqual(collapsed.platforms, ["instagram", "tiktok", "youtube", "facebook"]);
  assert.equal(collapsed.lines.find((line) => line.key === "instagram_reel")?.quantity, 2);
  assert.equal(collapsed.lines.find((line) => line.key === "mirrored_ig")?.quantity, 1);
  const dumped = deliverablesLabel(
    [{ platform: "instagram,tiktok,youtube,facebook", type: "instagram_reel", quantity: 1 }],
    "instagram,tiktok,youtube,facebook"
  );
  assert.equal(dumped.includes("instagram,tiktok"), false);
  assert.match(dumped, /Reel/);
  const byPlatform = summarizeDeliverablesByPlatform([
    { platform: "instagram,tiktok,youtube,facebook", type: "instagram_reel", quantity: 1 },
    { platform: "instagram,tiktok,youtube,facebook", type: "tiktok_video", quantity: 1 },
    { platform: "instagram,tiktok,youtube,facebook", type: "mirrored_ig", quantity: 1 },
  ]);
  assert.deepEqual(
    byPlatform.map((row) => row.platform),
    ["instagram", "tiktok"]
  );
  assert.equal(byPlatform.find((row) => row.platform === "instagram")?.lines.length, 2);
  assert.equal(byPlatform.find((row) => row.platform === "tiktok")?.lines[0]?.key, "tiktok_video");
  const split = creatorPlatformBreakdown({
    deliverableItems: [
      { platform: "instagram,tiktok,youtube,facebook", type: "instagram_reel", quantity: 1 },
      { platform: "instagram,tiktok,youtube,facebook", type: "tiktok_video", quantity: 1 },
    ],
    platformAccounts: [
      { platform: "instagram", handle: "@ali", followers: 83_200, engagementRate: 4.2 },
    ],
    fallback: { platform: "instagram", followers: 83_200, engagementRate: 93 },
  });
  assert.equal(split.find((row) => row.platform === "instagram")?.followers, 83_200);
  assert.equal(split.find((row) => row.platform === "tiktok")?.followers, undefined);
  assert.equal(split.find((row) => row.platform === "tiktok")?.engagementRate, undefined);
  assert.equal(providedText(undefined), "Not provided");
  assert.equal(providedText("  "), "Not provided");
  assert.equal(providedText("UAE"), "UAE");
});

test("creator names drop Instagram page-title tails and keep handle", () => {
  const identity = clientCreatorIdentity(
    "Coach Ghofran foad (@coach_ghofran) • Instagram photos and videos",
    null
  );
  assert.equal(identity.name, "Coach Ghofran foad");
  assert.equal(identity.handle, "coach_ghofran");
  assert.equal(formatHandleLabel(identity.handle), "@coach_ghofran");
  const parsed = parseSnapshotCreator({
    creatorId: "c1",
    displayName: "Coach Ghofran foad (@coach_ghofran) • Instagram photos and videos",
  });
  assert.equal(parsed.displayName.includes("photos and videos"), false);
  assert.equal(parsed.displayName, "Coach Ghofran foad");
  assert.equal(parsed.handle, "@coach_ghofran");
});

test("creator profile links stay per platform and only use http(s) urls", () => {
  const links = creatorProfileLinks(
    [
      {
        platform: "instagram",
        handle: "@ali",
        profileUrl: "https://www.instagram.com/ali/",
        lines: [],
      },
      {
        platform: "tiktok",
        handle: "@ali",
        lines: [],
      },
    ],
    { platform: "instagram", profileUrl: "javascript:alert(1)" }
  );
  assert.equal(links.length, 2);
  assert.equal(links[0]?.url, "https://www.instagram.com/ali/");
  assert.equal(links[1]?.url, "https://www.tiktok.com/@ali");
  assert.equal(
    links.every((link) => link.url.startsWith("https://")),
    true
  );
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
    "Content Plan",
    "Overview",
    "Feedback collaboration",
    "Advanced report",
  ];
  for (const capability of required) {
    const row = HYPEAUDITOR_MEDIA_PLAN_PARITY.find((item) => item.capability === capability);
    assert.ok(row, capability);
    assert.equal(row!.status, "shipped");
  }
  assert.equal(HYPEAUDITOR_MEDIA_PLAN_PARITY.find((row) => row.capability === "ROI")?.status, "not_copied");
  assert.equal(HYPEAUDITOR_MEDIA_PLAN_PARITY.find((row) => row.capability === "HypeAuditor AQS")?.status, "not_copied");
});

test("client workspace roster count matches the proposal snapshot, not Studio quantity copy", () => {
  assert.equal(rosterHeadline(13), "13 creators proposed");
  assert.equal(rosterSourceLine("shortlist"), "Source: Creator shortlist");
  assert.equal(rosterHeadline(1), "1 creator proposed");
});

test("activity mix groups actual deliverables instead of hiding them", () => {
  const mix = groupedActivityMix([
    { label: "Instagram Reel", count: 8 },
    { label: "Reel", count: 2 },
    { label: "Story", count: 8 },
    { label: "Feed Post", count: 8 },
  ]);
  assert.deepEqual(
    mix.map((item) => `${item.count} ${item.label}`),
    ["10 Reels", "8 Posts", "8 Stories"]
  );
});

test("strategic pillars prefer campaign facts over generic shortlist copy", () => {
  const pillars = strategicPillars({
    overview: {
      objective: "Drive festival attendance",
      audience: "UAE families",
      market: "United Arab Emirates",
      platforms: ["instagram"],
      whyThisApproach: "Creator shortlist for Liwa International Festival.",
      creatorCount: 13,
    },
    activityMix: [{ label: "Reels", count: 8 }],
    categories: ["Lifestyle"],
  });
  assert.ok(pillars.length >= 3);
  assert.equal(pillars.some((pillar) => /shortlist for/i.test(pillar.body)), false);
  assert.equal(pillars.some((pillar) => pillar.body === "Drive festival attendance"), true);
});

test("budget allocation chart is omitted unless a real services fee exists", () => {
  assert.equal(allocationSlices({ creatorInvestment: 100_000, totalInvestment: 100_000 }), null);
  assert.deepEqual(allocationSlices({ creatorInvestment: 92_000, feeAmount: 8_000, totalInvestment: 100_000 }), [
    { label: "Creator investment", count: 92 },
    { label: "Services", count: 8 },
  ]);
});

test("client-facing copy never exposes internal intelligence or commercial internals", () => {
  assert.equal(containsInternalTerminology("Campaign Match 92%"), false);
  assert.equal(containsInternalTerminology("ECI score 91"), true);
  assert.equal(containsInternalTerminology("vendor cost and GP margin"), true);
  assert.equal(clientSafeFitCopy("Strong UAE fit. Discovery Engine fingerprint graph."), "Strong UAE fit.");
});

test("audience quality maps to a display gauge without inventing AQS or ROI", () => {
  assert.equal(qualityGaugePercent("High Quality"), 88);
  assert.equal(qualityGaugePercent("Good"), 72);
  assert.equal(qualityGaugePercent("Monitor"), 48);
  assert.equal(qualityGaugePercent(undefined), undefined);
  assert.equal(qualityBadge("High Quality")?.text, "Excellent");
  assert.ok((engagementGaugePercent(3.4) ?? 0) > 40);
  assert.equal(engagementGaugePercent(undefined), undefined);
  assert.equal(levelMeterActiveSegment(88), 7);
  assert.equal(levelMeterActiveSegment(55), 4);
  assert.equal(levelMeterActiveSegment(22), 2);
  assert.equal(levelMeterActiveSegment(0), 0);
  assert.equal(containsInternalTerminology("AQS 72"), false);
  assert.equal(containsInternalTerminology("ROI 102%"), false);
});

test("snapshot preserves frozen audience quality and growth without fabricating series", () => {
  const snapshot = parseSourceSnapshot({
    source: "shortlist",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: [],
    creators: [
      {
        creatorId: "a",
        displayName: "A",
        audience: {
          frozenAt: "2026-08-17T00:00:00.000Z",
          ages: [{ label: "25-34", percent: 42 }],
          genders: [{ label: "Female", percent: 61 }],
          locations: [{ label: "United Arab Emirates", percent: 70 }],
          interests: ["Lifestyle"],
          qualityLabel: "High Quality",
          growthPercent: 4.2,
          followerGrowth: 1200,
        },
      },
    ],
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
  const audience = snapshot!.creators[0]?.audience;
  assert.equal(audience?.qualityLabel, "High Quality");
  assert.equal(audience?.growthPercent, 4.2);
  assert.equal(audience?.followerGrowth, 1200);
  const brief = briefFromSnapshotCreator(snapshot!.creators[0]!);
  assert.equal(brief.audience?.qualityLabel, "High Quality");
  assert.equal(brief.audience?.growthPercent, 4.2);
});

test("slimmed content feeds are replaced when live publications have metrics", () => {
  assert.equal(
    shouldReplaceContentFeed(
      [{ url: "https://instagram.com/p/1", thumbnail: "https://cdn.example/1.jpg", likes: null }],
      [{ url: "https://instagram.com/p/1", thumbnail: "https://cdn.example/1.jpg", likes: 120 }]
    ),
    true
  );
  assert.equal(
    shouldReplaceContentFeed(
      [{ url: "https://instagram.com/p/1", likes: 10 }],
      [{ url: "https://instagram.com/p/1", likes: 12 }]
    ),
    false
  );
  const merged = mergeFrozenBrief(
    {
      creatorId: "a",
      displayName: "A",
      contentFeed: [{ url: "https://instagram.com/p/1", thumbnail: "https://cdn.example/1.jpg", likes: null }],
      briefFrozenAt: "2026-01-01T00:00:00.000Z",
    },
    {
      enriched: {
        creatorId: "a",
        displayName: "A",
        bio: "Cairo-based creator",
        avgLikes: 120,
        contentFeed: [
          { url: "https://instagram.com/p/1", thumbnail: "https://cdn.example/1.jpg", likes: 120, comments: 8, views: 4000 },
          { url: "https://instagram.com/p/2", thumbnail: "https://cdn.example/2.jpg", likes: 90, comments: 4, views: 2800 },
        ],
      },
      bundle: null,
    }
  );
  assert.equal(merged.contentFeed?.length, 2);
  assert.equal(merged.contentFeed?.[0]?.likes, 120);
  assert.equal(merged.bio, "Cairo-based creator");
  assert.equal(merged.performance?.avgLikes, 120);
  assert.equal(merged.briefBackfillDone, true);
});

test("review media proxy only allows URLs frozen on the snapshot", () => {
  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: [],
    creators: [
      {
        creatorId: "a",
        displayName: "A",
        avatarUrl: "https://cdn.example/avatar.jpg",
        profileUrl: "https://www.instagram.com/radwaadeeel/",
        contentFeed: [
          {
            url: "https://www.instagram.com/p/ABC/",
            thumbnail: "https://scontent.cdninstagram.com/thumb.jpg?oh=1&amp;oe=2",
            likes: 20,
          },
        ],
        historical: [{ periodMonth: "2026-07-01", followers: 80_000, engagementRate: 3.1, following: 400, postsCount: 12 }],
      },
    ],
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
  const allow = reviewMediaAllowlist(snapshot);
  assert.equal(
    isReviewMediaUrlAllowed(allow, "https://scontent.cdninstagram.com/thumb.jpg?oh=1&oe=2", "https://www.instagram.com/p/ABC/"),
    true
  );
  assert.equal(isReviewMediaUrlAllowed(allow, "https://evil.example/x.jpg", null), false);
  assert.equal(
    isReviewMediaUrlAllowed(allow, "https://evil.example/x.jpg", "https://www.instagram.com/p/ABC/"),
    true
  );
  assert.equal(
    isReviewMediaUrlAllowed(allow, null, null, "https://www.instagram.com/radwaadeeel/"),
    true
  );
  assert.match(
    clientReviewAvatarUrl("t".repeat(16), undefined, "https://www.instagram.com/radwaadeeel/") ?? "",
    /kind=avatar/
  );
  assert.equal(snapshot!.creators[0]?.historical?.[0]?.followers, 80_000);
  assert.equal(snapshot!.creators[0]?.historical?.[0]?.following, 400);
  assert.equal(snapshot!.creators[0]?.historical?.[0]?.postsCount, 12);
});

test("missing avatars keep a social profile URL for the public review proxy", () => {
  assert.equal(
    profileUrlFromHandle("@radwaadeeel", "instagram"),
    "https://www.instagram.com/radwaadeeel/"
  );
  assert.equal(
    profileUrlFromHandle("@fsmand1", "snapchat"),
    "https://www.snapchat.com/add/fsmand1"
  );
  const enriched = enrichSnapshotCreatorFromUnified(
    {
      creatorId: "c1",
      displayName: "radwaadeeel",
      handle: "@radwaadeeel",
      platform: "instagram",
    },
    undefined
  );
  assert.equal(enriched.profileUrl, "https://www.instagram.com/radwaadeeel/");
  assert.equal(enriched.avatarUrl, undefined);
  assert.equal(enriched.platformAccounts?.[0]?.platform, "instagram");
  assert.equal(enriched.platformAccounts?.[0]?.followers, undefined);
});

test("Client Workspace fetches the TikTok photo when Snapchat is the stored profile", () => {
  const tiktokUrl = "https://www.tiktok.com/@rewlifts";
  assert.equal(
    avatarProfileUrlForReview({
      profileUrl: "https://www.snapchat.com/add/rewlifts",
      handle: "@rewlifts",
      platform: "snapchat",
      platformAccounts: [
        {
          platform: "snapchat",
          handle: "@rewlifts",
          profileUrl: "https://www.snapchat.com/add/rewlifts",
        },
        { platform: "tiktok", handle: "@rewlifts", profileUrl: tiktokUrl },
      ],
    }),
    tiktokUrl
  );

  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Limitless",
    campaignName: "KSA",
    clientLabel: "Limitless",
    platforms: ["snapchat", "tiktok"],
    deliverables: [],
    creators: [
      {
        creatorId: "rewlifts",
        displayName: "rewlifts",
        handle: "@rewlifts",
        platform: "snapchat",
        profileUrl: "https://www.snapchat.com/add/rewlifts",
        platformAccounts: [
          {
            platform: "snapchat",
            handle: "@rewlifts",
            profileUrl: "https://www.snapchat.com/add/rewlifts",
          },
          { platform: "tiktok", handle: "@rewlifts" },
        ],
      },
    ],
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
    creatorIds: ["rewlifts"],
  });
  assert.ok(snapshot);
  const allow = reviewMediaAllowlist(snapshot);
  assert.equal(isReviewMediaUrlAllowed(allow, null, null, tiktokUrl), true);
});

test("open reviews still backfill a missing creator photo after the brief was frozen", () => {
  assert.equal(
    needsClientBriefBackfill({
      creatorId: "rewlifts",
      displayName: "rewlifts",
      handle: "@rewlifts",
      briefBackfillDone: true,
      briefFrozenAt: "2026-09-01T00:00:00.000Z",
      profileUrl: "https://www.tiktok.com/@rewlifts",
      platformAccounts: [{ platform: "tiktok", handle: "@rewlifts" }],
      contentCategories: [{ label: "Fitness" }],
      categories: ["Fitness"],
    }),
    true
  );
  assert.equal(
    needsClientBriefBackfill({
      creatorId: "rewlifts",
      displayName: "rewlifts",
      handle: "@rewlifts",
      avatarUrl: "https://p16-sign-va.tiktokcdn.com/tos/avatar.jpeg",
      briefBackfillDone: true,
      briefFrozenAt: "2026-09-01T00:00:00.000Z",
      profileUrl: "https://www.tiktok.com/@rewlifts",
      platformAccounts: [{ platform: "tiktok", handle: "@rewlifts", followers: 129_000 }],
      contentCategories: [{ label: "Fitness" }],
      categories: ["Fitness"],
    }),
    false
  );
  assert.equal(
    needsClientBriefBackfill({
      creatorId: "ghanem",
      displayName: "Ghanem Shaker",
      avatarUrl: "https://cdn.example/a.jpg",
      briefBackfillDone: true,
      briefFrozenAt: "2026-09-01T00:00:00.000Z",
      profileUrl: "https://www.instagram.com/ghanem_shaker/",
      platformAccounts: [
        { platform: "instagram", handle: "@ghanem_shaker" },
        { platform: "tiktok", handle: "@ghanem_shaker" },
      ],
      contentCategories: [{ label: "Lifestyle" }],
      categories: ["Lifestyle"],
    }),
    true
  );
});

test("unified enrichment stores followers and ER per platform", () => {
  const enriched = enrichSnapshotCreatorFromUnified(
    {
      creatorId: "c1",
      displayName: "Ali Mahgoub",
      handle: "@ali",
      platform: "instagram,tiktok,youtube,facebook",
      followers: 999_999,
      engagementRate: 93,
      deliverableItems: [
        { platform: "instagram,tiktok,youtube,facebook", type: "instagram_reel", quantity: 1 },
        { platform: "instagram,tiktok,youtube,facebook", type: "tiktok_video", quantity: 1 },
      ],
    },
    {
      unified_id: "c1",
      display_name: "Ali Mahgoub",
      metrics: {
        followers: { value: 999_999, confidence: "estimated" },
        engagement_rate: { value: 93, confidence: "estimated" },
        avg_likes: { value: 530, confidence: "estimated" },
        avg_comments: { value: 38, confidence: "estimated" },
        avg_views: { value: 7500, confidence: "estimated" },
        posting_frequency_per_week: { value: null, confidence: "estimated" },
      },
      platforms: [
        {
          id: "ig",
          platform: "instagram",
          handle: "ali",
          profile_url: "https://www.instagram.com/ali/",
          follower_count: 83_200,
          engagement_rate: 4.2,
          avg_likes: 530,
          audience_country: "EG",
        },
        {
          id: "tt",
          platform: "tiktok",
          handle: "ali",
          profile_url: "https://www.tiktok.com/@ali",
          follower_count: 120_000,
          engagement_rate: 6.1,
          audience_country: "EG",
        },
      ],
      categories: [],
      language_codes: [],
      thinkway_score: 0,
      source_confidence: 0,
      brand_fit_score: null,
      is_platform_verified: false,
      authenticity_score: null,
      ai_category: null,
      ai_niche: null,
      source_type: "internal",
      influencer_id: null,
      discovered_profile_id: null,
      document_number: null,
      status: null,
      country_code: "EG",
      estimated_country: "EG",
      city: "Cairo",
      bio: null,
      profile_image_url: null,
    }
  );
  assert.equal(enriched.platformAccounts?.length, 2);
  assert.equal(enriched.platformAccounts?.find((row) => row.platform === "instagram")?.followers, 83_200);
  assert.equal(enriched.platformAccounts?.find((row) => row.platform === "tiktok")?.followers, 120_000);
  assert.notEqual(
    enriched.platformAccounts?.find((row) => row.platform === "tiktok")?.engagementRate,
    93
  );
  const rows = creatorPlatformBreakdown({
    deliverableItems: enriched.deliverableItems,
    platformAccounts: enriched.platformAccounts,
    fallback: {
      platform: enriched.platform,
      followers: enriched.followers,
      engagementRate: enriched.engagementRate,
    },
  });
  assert.equal(rows.find((row) => row.platform === "instagram")?.followers, 83_200);
  assert.equal(rows.find((row) => row.platform === "tiktok")?.followers, 120_000);
  assert.deepEqual(listPlatformChipMetrics(rows.find((row) => row.platform === "instagram")!), {
    followers: "83.2K",
    engagementRate: "4.2%",
  });
  assert.deepEqual(listPlatformChipMetrics(rows.find((row) => row.platform === "tiktok")!), {
    followers: "120.0K",
    engagementRate: "6.1%",
  });
  assert.equal(rows.some((row) => row.platform === "youtube"), false);
});

test("quotation snapshot diffs are client-safe and name added creators", () => {
  const previous = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [
      { creatorId: "a", displayName: "Ali", investmentAmount: 1000, deliverables: "Reel" },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 1000,
      totalInvestment: 1000,
      lines: [],
      selectedCount: 1,
      totalCount: 1,
    },
    creatorIds: ["a"],
  });
  const next = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: ["Reel", "Story"],
    creators: [
      { creatorId: "a", displayName: "Ali", investmentAmount: 1500, deliverables: "Reel x 2" },
      { creatorId: "b", displayName: "radwaadeeel", investmentAmount: 800, deliverables: "Story" },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 2300,
      totalInvestment: 2300,
      lines: [],
      selectedCount: 2,
      totalCount: 2,
    },
    creatorIds: ["a", "b"],
  });
  assert.ok(previous && next);
  const items = diffClientReviewSnapshots(previous, next);
  assert.equal(items.some((item) => item.includes("radwaadeeel")), true);
  assert.equal(items.some((item) => /investment/i.test(item)), true);
  assert.equal(items.some((item) => /deliverable/i.test(item)), true);
  assert.equal(items.every((item) => !/ECI|Apify|margin|GP/i.test(item)), true);
});

test("in-place quotation updates keep prior creator briefs", () => {
  const previous = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [
      {
        creatorId: "a",
        displayName: "Ali",
        investmentAmount: 1000,
        bio: "Creator bio",
        contentFeed: [{ thumbnail: "https://cdn.example/p1.jpg", likes: 12 }],
      },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 1000,
      totalInvestment: 1000,
      lines: [],
      selectedCount: 1,
      totalCount: 1,
    },
    creatorIds: ["a"],
  });
  const next = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [{ creatorId: "a", displayName: "Ali", investmentAmount: 1200 }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 1200,
      totalInvestment: 1200,
      lines: [],
      selectedCount: 1,
      totalCount: 1,
    },
    creatorIds: ["a"],
  });
  assert.ok(previous && next);
  const merged = retainCreatorBriefs(previous, next);
  assert.equal(merged.creators[0]?.bio, "Creator bio");
  assert.equal(merged.creators[0]?.contentFeed?.[0]?.thumbnail, "https://cdn.example/p1.jpg");
  assert.equal(merged.creators[0]?.investmentAmount, 1200);
});

test("recent publications mix across deliverable platforms using post URLs", () => {
  const mixed = mixPostsForDeliverables(
    [
      { url: "https://instagram.com/p/1", platform: "instagram", likes: 1 },
      { url: "https://instagram.com/p/2", platform: "instagram", likes: 2 },
      { url: "https://www.tiktok.com/@x/video/1", platform: "instagram", likes: 3 },
      { url: "https://www.youtube.com/watch?v=1", platform: "instagram", likes: 4 },
    ],
    [
      { platform: "instagram,tiktok,youtube", type: "instagram_reel", quantity: 1 },
      { platform: "instagram,tiktok,youtube", type: "tiktok_video", quantity: 1 },
    ],
    3
  );
  assert.deepEqual(
    mixed.map((post) => post.platform),
    ["instagram", "tiktok", "youtube"]
  );
});

test("missing platform metrics stay blank on the avatar chip", () => {
  assert.equal(formatOptionalEngagementPct(undefined), null);
  assert.equal(formatOptionalEngagementPct(8.8), "8.8%");
  assert.equal(formatOptionalCompactCount(undefined), null);
  assert.equal(formatOptionalCompactCount(2100), "2.1K");
  assert.deepEqual(listPlatformChipMetrics({ followers: 4_700_000, engagementRate: 3.2 }), {
    followers: "4.7M",
    engagementRate: "3.2%",
  });
  assert.deepEqual(listPlatformChipMetrics({ followers: 129_000, engagementRate: 14.8 }), {
    followers: "129.0K",
    engagementRate: "14.8%",
  });
  assert.deepEqual(listPlatformChipMetrics({ engagementRate: 14.8 }), {
    followers: null,
    engagementRate: "14.8%",
  });
  assert.deepEqual(listPlatformChipMetrics({}), { followers: null, engagementRate: null });
});

test("client engagement rates stay percentages — 0.9 is 0.9%, not 90%", () => {
  assert.equal(formatEngagementPct(0.9), "0.9%");
  assert.equal(formatEngagementPct(0.903), "0.9%");
  assert.equal(formatEngagementPct(4.2), "4.2%");
  assert.equal(formatEngagementPct(193.4), "1.9%");
  assert.equal(engagementBadge(0.9)?.text, "Average");
  assert.equal(engagementBadge(6.1)?.text, "Excellent");
  assert.ok((engagementGaugePercent(0.9) ?? 0) < (engagementGaugePercent(4.2) ?? 0));
  assert.equal(engagementGaugePercent(193.4), engagementGaugePercent(1.934));
});

test("creator card engagement meters stay per platform", () => {
  const meters = engagementMetersForBreakdown(
    [
      { platform: "instagram", engagementRate: 0.9, lines: [] },
      { platform: "tiktok", engagementRate: 6.0, lines: [] },
    ],
    0.9
  );
  assert.deepEqual(
    meters.map((meter) => [meter.platform, meter.rate, formatEngagementRateLabel(meter.platform)]),
    [
      ["instagram", 0.9, "Instagram engagement rate"],
      ["tiktok", 6, "TikTok engagement rate"],
    ]
  );
  assert.equal(engagementMetersForBreakdown([], 4.2)[0]?.rate, 4.2);
  assert.equal(formatEngagementRateLabel(undefined), "Engagement rate");
  const tiktokMissing = engagementMetersForBreakdown(
    [
      { platform: "instagram", engagementRate: 0.9, lines: [] },
      { platform: "tiktok", lines: [] },
    ],
    0.9
  );
  assert.equal(tiktokMissing.find((row) => row.platform === "tiktok")?.rate, undefined);
});

test("publication platform is inferred from the content URL", () => {
  assert.equal(
    resolveContentPostPlatform({ url: "https://www.tiktok.com/@x/video/1" }),
    "tiktok"
  );
  assert.equal(
    resolveContentPostPlatform({ url: "https://www.facebook.com/reel/1", platform: "instagram" }),
    "facebook"
  );
  const mixed = mixPostsForDeliverables(
    [{ url: "https://www.instagram.com/p/1", likes: 12 }, { url: "https://www.tiktok.com/@x/video/2", likes: 8 }],
    [{ platform: "instagram,tiktok", type: "instagram_reel", quantity: 1 }],
    2
  );
  assert.deepEqual(
    mixed.map((post) => post.platform),
    ["instagram", "tiktok"]
  );
});

test("acknowledged proposal updates are not shown again", () => {
  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [{ creatorId: "a", displayName: "Ali" }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 0,
      totalInvestment: 0,
      lines: [],
      selectedCount: 0,
      totalCount: 1,
    },
    creatorIds: ["a"],
    clientUpdate: {
      updatedAt: "2026-08-18T00:00:00.000Z",
      items: ["Deliverables were updated."],
      acknowledgedAt: "2026-08-18T01:00:00.000Z",
    },
  });
  assert.equal(visibleClientUpdateNotice(snapshot?.clientUpdate), undefined);
  assert.equal(
    visibleClientUpdateNotice({
      updatedAt: "2026-08-18T00:00:00.000Z",
      items: ["Deliverables were updated."],
    })?.items[0],
    "Deliverables were updated."
  );
});

test("estimated reach copy uses follower share without inventing a second engine", () => {
  const insight = estimatedReachInsight({ reach: 14_700, followers: 141_000 });
  assert.equal(insight?.value, "14.7K");
  assert.equal(insight?.badge?.text, "Average");
  assert.match(insight?.explanation ?? "", /10\.4%/);
  assert.equal(estimatedReachInsight({ reach: undefined }), null);
});

test("brand mentions keep names from the snapshot and only show a 180-day label when that window exists", () => {
  const legacy = normalizeBrandMentions(["Nike", "Pepsi"]);
  assert.deepEqual(
    legacy.map((item) => item.name),
    ["Nike", "Pepsi"]
  );
  assert.equal(brandDomainGuess("Nike"), "nike.com");
  assert.equal(brandDomainGuess("Xiaomi Egypt"), "xiaomi.com");
  assert.equal(brandDomainGuess("Samsung UAE"), "samsung.com");
  assert.equal(brandDomainGuess("Coca Cola Egypt"), "coca-cola.com");
  assert.equal(isLikelyWebsiteDomain("lo.labeauty"), false);
  assert.equal(isLikelyWebsiteDomain("nike.com"), true);
  assert.equal(brandSocialHandle({ name: "Lo Labeauty", handle: "lo.labeauty" }), "lo.labeauty");
  assert.equal(brandSocialHandle({ name: "Lo Labeauty" }), "lolabeauty");
  assert.equal(isKnownBrandDomain("Nike"), true);
  assert.equal(isKnownBrandDomain("Lo Labeauty", "lo.labeauty"), false);
  const loSources = brandLogoServerSources({ name: "Lo Labeauty", handle: "lo.labeauty" });
  assert.equal(loSources[0], "https://unavatar.io/instagram/lo.labeauty?fallback=false");
  assert.equal(
    loSources.some((url) => url.includes("lo.labeauty.ico") || url.includes("domain=lo.labeauty")),
    false,
    "dotted Instagram handles must not be treated as website favicons"
  );
  const nikeSources = brandLogoClientSources({ name: "Nike", handle: "nike" }, "t".repeat(16));
  assert.equal(nikeSources[0], "https://unavatar.io/instagram/nike?fallback=false");
  assert.match(nikeSources[2] ?? "", /\/api\/review\/brand-logo/);
  const withWindow = brandMentionsInsight([
    { name: "Nike", mentionsLast180Days: 2 },
    { name: "Pepsi", mentionsLast180Days: 1 },
    { name: "Adidas", mentionsLast180Days: 1 },
    { name: "Samsung", mentionsLast180Days: 1 },
    { name: "Starbucks", mentionsLast180Days: 1 },
    { name: "BMW", mentionsLast180Days: 1 },
    { name: "Apple", mentionsLast180Days: 1 },
    { name: "Sony", mentionsLast180Days: 1 },
    { name: "Oreo", mentionsLast180Days: 1 },
  ]);
  assert.equal(withWindow?.count, 9);
  assert.equal(withWindow?.windowDays, 180);
  assert.equal(withWindow?.badge?.text, "Optimal");
  const snapshot = parseSnapshotCreator({
    creatorId: "a",
    displayName: "Ali",
    brandMentions: ["Nike", { name: "Pepsi", mentionsLast180Days: 3 }],
  });
  assert.equal(snapshot?.brandMentions?.[0]?.name, "Nike");
  assert.equal(snapshot?.brandMentions?.[1]?.mentionsLast180Days, 3);
  assert.equal(clientReviewBrandLogoPath("t".repeat(16), "Pepsi").includes("name=Pepsi"), true);
});

test("content categories drop junk labels and keep unique icons plus ECI shares", () => {
  assert.equal(isDisplayableCategory("Can't"), false);
  assert.equal(isDisplayableCategory("Lifestyle"), true);
  const display = contentCategoriesForDisplay(undefined, [
    "Lifestyle",
    "Fitness & Yoga",
    "Can't",
    "Food",
    "Fitness",
  ]);
  assert.deepEqual(
    display.map((item) => item.label),
    ["Lifestyle", "Fitness & Yoga", "Food", "Fitness"]
  );
  assert.deepEqual(
    listCreatorCategoryStickers({
      contentCategories: [{ label: "Food" }, { label: "Fitness" }, { label: "Travel" }],
    }),
    ["Food", "Fitness"]
  );
  assert.deepEqual(listCreatorCategoryStickers({ category: "Sports", niche: "Fitness" }), [
    "Sports",
    "Fitness",
  ]);
  assert.equal(categoryFamily("Camera & Photography"), "photography");
  assert.equal(categoryFamily("Fitness & Yoga"), "health");
  assert.equal(categoryFamily("Food"), "food");
  const shares = contentCategoriesFromShares([
    { category: "Lifestyle", percent: 42, postCount: 18 },
    { category: "Other", percent: 20, postCount: 8 },
    { category: "Food", percent: 18, postCount: 7 },
  ]);
  assert.deepEqual(
    shares.map((item) => `${item.label}:${item.percent}`),
    ["Lifestyle:42", "Food:18"]
  );
  const parsed = parseSnapshotCreator({
    creatorId: "a",
    displayName: "Ali",
    categories: ["Lifestyle", "Can't"],
    contentCategories: [{ label: "Lifestyle", percent: 42 }],
  });
  assert.equal(parsed.contentCategories?.[0]?.percent, 42);
  const merged = mergeFrozenBrief(
    {
      creatorId: "a",
      displayName: "A",
      categories: ["Lifestyle", "Can't", "Food"],
    },
    {
      enriched: {
        creatorId: "a",
        displayName: "A",
        categories: ["Lifestyle", "Can't", "Food"],
      },
      bundle: null,
    }
  );
  assert.deepEqual(merged.categories, ["Lifestyle", "Food"]);
  assert.equal(merged.categories?.includes("Can't"), false);
});

test("brand logo proxy only serves names frozen on the review snapshot", () => {
  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme Legal",
    platforms: ["instagram"],
    deliverables: [],
    creators: [
      {
        creatorId: "a",
        displayName: "A",
        brandMentions: [{ name: "Pepsi", handle: "pepsi" }, { name: "Lo Labeauty", handle: "lo.labeauty" }],
      },
    ],
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
  assert.equal(reviewBrandMentionAllowed(snapshot, "Pepsi")?.handle, "pepsi");
  assert.equal(reviewBrandMentionAllowed(snapshot, "Lo Labeauty", "lo.labeauty")?.handle, "lo.labeauty");
  assert.equal(reviewBrandMentionAllowed(snapshot, "Nike"), null);
});

test("accepted creators and content rows follow the current selection", () => {
  const creators = [
    {
      creatorId: "a",
      displayName: "A",
      selection: "accepted" as const,
      platform: "instagram",
      deliverables: "1 Reel",
      deliverableItems: [{ platform: "instagram", type: "Reel", quantity: 1 }],
      contentExamples: [],
    },
    {
      creatorId: "b",
      displayName: "B",
      selection: "in_review" as const,
      platform: "tiktok",
      deliverables: "2 Story",
      deliverableItems: [{ platform: "tiktok", type: "Story", quantity: 2 }],
      contentExamples: [],
    },
  ];
  const selection = { a: "accepted" as const, b: "in_review" as const };
  const accepted = acceptedCreators(creators, selection);
  assert.deepEqual(accepted.map((creator) => creator.creatorId), ["a"]);
  const rows = contentRowsForSelection(
    [
      { creatorId: "a", creatorName: "A", platform: "instagram", deliverable: "1 Reel" },
      { creatorId: "b", creatorName: "B", platform: "tiktok", deliverable: "2 Story" },
    ],
    creators,
    selection
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.creatorId, "a");
  const mix = creatorMixFromRoster(accepted);
  assert.equal(mix.platforms.find((item) => item.label === "Instagram")?.count, 1);
  assert.equal(mix.platforms.some((item) => item.label === "TikTok"), false);
});

test("accept can be removed until the client submits the selection", () => {
  assert.equal(nextAcceptState("in_review"), "accepted");
  assert.equal(nextAcceptState("accepted"), "in_review");
  assert.equal(nextAcceptState("rejected"), "accepted");
});

test("approved and rejected reviews are frozen and cannot be reused", () => {
  assert.equal(isFrozenClientReviewStatus("approved"), true);
  assert.equal(isFrozenClientReviewStatus("rejected"), true);
  assert.equal(isReusableClientReviewTip("approved", true), false);
  assert.equal(isReusableClientReviewTip("rejected", true), false);
  assert.equal(isReusableClientReviewTip("superseded", true), false);
  assert.equal(isReusableClientReviewTip("awaiting_review", true), true);
  assert.equal(isReusableClientReviewTip("changes_requested", true), true);
  assert.equal(isReusableClientReviewTip("awaiting_review", false), false);
});

test("quotation live-sync is only allowed for open unconverted quotations", () => {
  assert.equal(
    canLiveSyncClientReview({ status: "awaiting_review", source: "quotation" }),
    true
  );
  assert.equal(canLiveSyncClientReview({ status: "approved", source: "quotation" }), false);
  assert.equal(canLiveSyncClientReview({ status: "rejected", source: "quotation" }), false);
  assert.equal(
    canLiveSyncClientReview({
      status: "awaiting_review",
      source: "quotation",
      campaignHeaderId: "c1",
    }),
    false
  );
  assert.equal(canLiveSyncClientReview({ status: "awaiting_review", source: "shortlist" }), false);
});

test("shortlist and quotation stages stay independent", () => {
  assert.equal(deriveShortlistStage({ review: null }), "not_sent");
  assert.equal(
    deriveShortlistStage({ review: { status: "awaiting_review", firstViewedAt: null } }),
    "sent"
  );
  assert.equal(
    deriveShortlistStage({
      review: { status: "awaiting_review", firstViewedAt: "2026-08-20T10:00:00.000Z" },
    }),
    "viewed"
  );
  assert.equal(
    deriveShortlistStage({ review: { status: "approved", firstViewedAt: "2026-08-20T10:00:00.000Z" } }),
    "approved"
  );
  assert.equal(
    deriveQuotationStage({
      quotationExists: true,
      review: null,
      priorApprovedReview: false,
      movedToCampaign: false,
    }),
    "draft"
  );
  assert.equal(
    deriveQuotationStage({
      quotationExists: true,
      review: { status: "awaiting_review", firstViewedAt: null },
      priorApprovedReview: true,
      movedToCampaign: false,
    }),
    "updated"
  );
  assert.equal(
    deriveQuotationStage({
      quotationExists: true,
      review: { status: "approved", firstViewedAt: null },
      priorApprovedReview: false,
      movedToCampaign: false,
    }),
    "approved"
  );
  assert.equal(
    deriveQuotationStage({
      quotationExists: true,
      review: { status: "rejected", firstViewedAt: null },
      priorApprovedReview: false,
      movedToCampaign: false,
    }),
    "rejected"
  );
  const action = journeyActionRequired({
    shortlistStage: "approved",
    quotationStage: "updated",
    historical: false,
  });
  assert.match(action, /updated quotation/i);
  assert.equal(action.includes("Shortlist"), false);
});

test("unapproved shortlist does not block quotation sending or campaign conversion rules", () => {
  assert.equal(deriveShortlistStage({ review: null }), "not_sent");
  assert.equal(
    deriveQuotationStage({
      quotationExists: true,
      review: { status: "awaiting_review", firstViewedAt: null },
      priorApprovedReview: false,
      movedToCampaign: false,
    }),
    "sent_for_approval"
  );
  assert.equal(canCreateCampaignFromQuotation("approved"), true);
  assert.equal(canCreateCampaignFromQuotation("sent"), false);
  assert.equal(canCreateCampaignFromQuotation("draft"), false);
});

test("same journey token accepts canonical, member, and active review ids", () => {
  assert.equal(
    reviewIdBelongsToJourney("landing", {
      canonicalReviewId: "landing",
      memberReviewIds: ["landing", "quote-1"],
      activeReviewId: "quote-1",
      journeyId: "journey-1",
    }),
    true
  );
  assert.equal(
    reviewIdBelongsToJourney("quote-1", {
      canonicalReviewId: "landing",
      memberReviewIds: ["landing", "quote-1"],
      activeReviewId: "quote-1",
    }),
    true
  );
  assert.equal(
    reviewIdBelongsToJourney("other", {
      canonicalReviewId: "landing",
      memberReviewIds: ["landing"],
      activeReviewId: "landing",
    }),
    false
  );
});

test("canonical shortlist URL is not treated as a historical freeze when a quotation exists", () => {
  const shortlist = {
    id: "s1",
    source: "shortlist" as const,
    status: "approved" as const,
    reviewNumber: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  const quotation = {
    id: "q1",
    source: "quotation" as const,
    status: "awaiting_review" as const,
    reviewNumber: 1,
    createdAt: "2026-08-02T00:00:00.000Z",
  };
  const picked = pickActiveDecisionReview({
    reviews: [shortlist, quotation] as never,
    requestedReviewId: "s1",
    canonicalReviewId: "s1",
  });
  assert.equal(picked.historical, false);
  assert.equal(picked.review?.id, "q1");
});

test("older frozen quotation URLs remain readable as historical versions", () => {
  const first = {
    id: "q1",
    source: "quotation" as const,
    status: "approved" as const,
    reviewNumber: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  const next = {
    id: "q2",
    source: "quotation" as const,
    status: "awaiting_review" as const,
    reviewNumber: 2,
    createdAt: "2026-08-03T00:00:00.000Z",
  };
  const picked = pickActiveDecisionReview({
    reviews: [first, next] as never,
    requestedReviewId: "q1",
    canonicalReviewId: "s1",
  });
  assert.equal(picked.historical, true);
  assert.equal(picked.review?.id, "q1");
});

test("review-specific tokens still freeze historical versions even when the URL is the canonical landing", () => {
  const shortlist = {
    id: "s1",
    source: "shortlist" as const,
    status: "approved" as const,
    reviewNumber: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
  const first = {
    id: "q1",
    source: "quotation" as const,
    status: "approved" as const,
    reviewNumber: 1,
    createdAt: "2026-08-02T00:00:00.000Z",
  };
  const next = {
    id: "q2",
    source: "quotation" as const,
    status: "awaiting_review" as const,
    reviewNumber: 2,
    createdAt: "2026-08-03T00:00:00.000Z",
  };
  const picked = pickActiveDecisionReview({
    reviews: [shortlist, first, next] as never,
    requestedReviewId: "q1",
    canonicalReviewId: "s1",
    tokenBoundReviewId: "q1",
  });
  assert.equal(picked.historical, true);
  assert.equal(picked.review?.id, "q1");
});

test("quotation-first journeys use the first quotation review as the canonical landing", () => {
  assert.equal(
    journeyCanonicalReviewId(
      [
        { id: "q1", source: "quotation", createdAt: "2026-08-02T00:00:00.000Z" },
      ],
      "fallback"
    ),
    "q1"
  );
});

test("shortlist approval never creates a quotation, locks commercial value, or sets quotations.status", () => {
  const approved = clientApprovalSideEffects("shortlist", "approved");
  assert.equal(approved.createQuotation, false);
  assert.equal(approved.lockCommercial, false);
  assert.equal(approved.setQuotationStatusApproved, false);
  assert.equal(approved.rejectPairedShortlist, false);
});

test("quotation approval sets quotations.status and does not create another quotation", () => {
  const approved = clientApprovalSideEffects("quotation", "approved");
  assert.equal(approved.setQuotationStatusApproved, true);
  assert.equal(approved.lockCommercial, true);
  assert.equal(approved.createQuotation, false);
  assert.equal(canCreateCampaignFromQuotation("approved"), true);
});

test("rejecting a quotation does not reject the shortlist or rewrite commercial freeze", () => {
  const rejected = clientApprovalSideEffects("quotation", "rejected");
  assert.equal(rejected.rejectPairedShortlist, false);
  assert.equal(rejected.setQuotationStatusApproved, false);
  assert.equal(rejected.lockCommercial, false);
});

test("typed shortlist-to-quotation diff covers added, removed, investment, and deliverables", () => {
  const shortlist = parseSourceSnapshot({
    source: "shortlist",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [
      { creatorId: "a", displayName: "Creator A", investmentAmount: 40000, deliverables: "Reel x 1" },
      { creatorId: "b", displayName: "Creator B", investmentAmount: 20000, deliverables: "Story" },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 60000,
      totalInvestment: 60000,
      lines: [],
      selectedCount: 2,
      totalCount: 2,
    },
    creatorIds: ["a", "b"],
  });
  const quotation = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme",
    platforms: ["instagram"],
    deliverables: ["Reel", "Story"],
    creators: [
      { creatorId: "a", displayName: "Creator A", investmentAmount: 50000, deliverables: "Reel x 2" },
      { creatorId: "c", displayName: "Creator C", investmentAmount: 10000, deliverables: "Story" },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: 60000,
      totalInvestment: 60000,
      lines: [],
      selectedCount: 2,
      totalCount: 2,
    },
    creatorIds: ["a", "c"],
  });
  const diff = diffShortlistToQuotation(shortlist, quotation);
  assert.ok(diff);
  assert.equal(diff!.commercialChangedAfterShortlistApproval, true);
  assert.equal(diff!.rows.find((row) => row.creatorId === "a")?.investmentChanged, true);
  assert.equal(diff!.rows.find((row) => row.creatorId === "a")?.investmentDelta, 10000);
  assert.equal(diff!.rows.find((row) => row.creatorId === "a")?.deliverablesChanged, true);
  assert.equal(diff!.rows.find((row) => row.creatorId === "b")?.kind, "removed");
  assert.equal(diff!.rows.find((row) => row.creatorId === "c")?.kind, "added");
  assert.ok(diff!.summaryItems.some((item) => /commercial value changed after shortlist approval/i.test(item)));
});

function quotationSnapshot(
  campaignName: string,
  investment: number,
  creatorId: string,
  creatorInvestment = investment
) {
  return parseSourceSnapshot({
    source: "quotation",
    brandName: "Tuna",
    campaignName,
    clientLabel: "Tuna",
    platforms: ["instagram"],
    deliverables: ["Reel"],
    creators: [
      {
        creatorId,
        displayName: creatorId === "faisal" ? "Faisal" : `Creator ${creatorId}`,
        investmentAmount: creatorInvestment,
        deliverables: "Reel x 1",
      },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "Duration not confirmed", phases: [] },
    commercial: {
      currency: "EGP",
      creatorInvestment: creatorInvestment,
      totalInvestment: investment,
      lines: [],
      selectedCount: 1,
      totalCount: 1,
    },
    creatorIds: [creatorId],
  });
}

test("historical quotation URLs keep frozen version state after a later version is published", () => {
  const v1Snapshot = quotationSnapshot("Liwa International Festival v1", 557_142.87, "faisal", 64_286);
  const v2Snapshot = quotationSnapshot("Liwa International Festival v2", 571_428.59, "faisal", 64_286);
  const shortlist = {
    id: "s1",
    source: "shortlist" as const,
    status: "approved" as const,
    reviewNumber: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    firstViewedAt: "2026-08-01T01:00:00.000Z",
    journeyId: "j1",
  };
  const v1 = {
    id: "q1",
    source: "quotation" as const,
    status: "approved" as const,
    reviewNumber: 1,
    createdAt: "2026-08-10T00:00:00.000Z",
    firstViewedAt: "2026-08-10T01:00:00.000Z",
    journeyId: "j1",
    quotationId: "quote-1",
    approvedAt: "2026-08-18T00:00:00.000Z",
    sourceSnapshot: v1Snapshot,
  };
  const v2 = {
    id: "q2",
    source: "quotation" as const,
    status: "awaiting_review" as const,
    reviewNumber: 2,
    createdAt: "2026-08-19T00:00:00.000Z",
    firstViewedAt: null,
    journeyId: "j1",
    quotationId: "quote-1",
    campaignHeaderId: null,
    sourceSnapshot: v2Snapshot,
  };
  const members = [shortlist, v1, v2];
  const canonicalReviewId = journeyCanonicalReviewId(members, "s1");
  assert.equal(canonicalReviewId, "s1");

  const openedV1 = pickActiveDecisionReview({
    reviews: members,
    requestedReviewId: "q1",
    canonicalReviewId,
  });
  assert.equal(openedV1.historical, true);
  assert.equal(openedV1.review?.id, "q1");
  assert.equal(openedV1.review?.sourceSnapshot?.campaignName, "Liwa International Festival v1");
  assert.equal(openedV1.review?.sourceSnapshot?.commercial.totalInvestment, 557_142.87);
  assert.equal(openedV1.review?.sourceSnapshot?.creators[0]?.creatorId, "faisal");
  assert.equal(openedV1.review?.sourceSnapshot?.creators[0]?.investmentAmount, 64_286);
  assert.equal(
    snapshotForReview({ sourceSnapshot: v1Snapshot } as never)?.commercial.totalInvestment,
    557_142.87
  );
  assert.notEqual(openedV1.review?.sourceSnapshot?.campaignName, v2Snapshot.campaignName);
  assert.notEqual(openedV1.review?.sourceSnapshot?.commercial.totalInvestment, 571_428.59);

  const historicalJourney = projectClientJourney({
    members,
    viewed: openedV1.review!,
    historical: true,
    canonicalReviewId,
  });
  assert.equal(historicalJourney.historical, true);
  assert.equal(historicalJourney.quotationStage, "superseded");
  assert.equal(QUOTATION_STAGE_LABEL[historicalJourney.quotationStage], "Historical / Superseded");
  assert.equal(historicalJourney.quotationStage === "updated", false);
  assert.equal(historicalJourney.quotationStage === "approved", false);
  assert.equal(historicalJourney.campaignStarted, false);
  assert.equal(historicalJourney.performanceStarted, false);
  assert.equal(historicalJourney.movedToCampaign, false);
  assert.equal(historicalJourney.campaignHeaderId, null);
  assert.equal(historicalJourney.canApproveQuotation, false);
  assert.equal(historicalJourney.canApproveShortlist, false);
  assert.equal(historicalJourney.canRejectQuotation, false);
  assert.equal(historicalJourney.canRequestQuotationChanges, false);
  assert.equal(historicalJourney.canRequestShortlistChanges, false);
  assert.equal(
    approvalWorkspaceKind({
      historical: true,
      quotationStage: historicalJourney.quotationStage,
      canApproveShortlist: historicalJourney.canApproveShortlist,
      canApproveQuotation: historicalJourney.canApproveQuotation,
    }),
    "historical"
  );
  assert.equal(
    clientWorkspaceVersionPill({
      historical: true,
      reviewNumber: 1,
      newerReviewNumber: 2,
    }),
    "Historical · v1"
  );
  assert.equal(
    clientWorkspacePathReviewId({
      historical: true,
      viewedReviewId: "q1",
      canonicalReviewId,
    }),
    "q1"
  );
  assert.equal(
    canMutateClientReviewFromBoundReview({
      reviews: members,
      boundReviewId: "q1",
      canonicalReviewId,
    }),
    false
  );
  assert.match(journeyActionRequired(historicalJourney), /frozen historical version/i);

  const openedCanonical = pickActiveDecisionReview({
    reviews: members,
    requestedReviewId: "s1",
    canonicalReviewId,
  });
  assert.equal(openedCanonical.historical, false);
  assert.equal(openedCanonical.review?.id, "q2");
  assert.equal(openedCanonical.review?.sourceSnapshot?.campaignName, "Liwa International Festival v2");
  assert.equal(openedCanonical.review?.sourceSnapshot?.commercial.totalInvestment, 571_428.59);

  const currentJourney = projectClientJourney({
    members,
    viewed: openedCanonical.review!,
    historical: false,
    canonicalReviewId,
  });
  assert.equal(currentJourney.historical, false);
  assert.equal(currentJourney.quotationStage, "updated");
  assert.equal(QUOTATION_STAGE_LABEL[currentJourney.quotationStage], "Updated — Approval required");
  assert.equal(currentJourney.campaignStarted, false);
  assert.equal(currentJourney.canApproveQuotation, true);
  assert.equal(currentJourney.canRejectQuotation, true);
  assert.equal(currentJourney.canRequestQuotationChanges, true);
  assert.equal(
    approvalWorkspaceKind({
      historical: false,
      quotationStage: currentJourney.quotationStage,
      canApproveShortlist: currentJourney.canApproveShortlist,
      canApproveQuotation: currentJourney.canApproveQuotation,
    }),
    "open"
  );
  assert.equal(
    clientWorkspaceVersionPill({
      historical: false,
      reviewNumber: 2,
      newerReviewNumber: null,
    }),
    "Current · v2"
  );
  assert.equal(
    clientWorkspacePathReviewId({
      historical: false,
      viewedReviewId: "q2",
      canonicalReviewId,
    }),
    "s1"
  );
  assert.equal(
    canMutateClientReviewFromBoundReview({
      reviews: members,
      boundReviewId: "s1",
      canonicalReviewId,
    }),
    true
  );
  assert.equal(
    reviewIdBelongsToJourney("q1", {
      canonicalReviewId,
      memberReviewIds: members.map((item) => item.id),
      activeReviewId: "q2",
      journeyId: "j1",
    }),
    true
  );
});

test("superseded quotation URLs do not inherit later approval or campaign state", () => {
  const v1 = {
    id: "q1",
    source: "quotation" as const,
    status: "superseded" as const,
    reviewNumber: 1,
    createdAt: "2026-08-10T00:00:00.000Z",
    firstViewedAt: "2026-08-10T01:00:00.000Z",
    journeyId: "j1",
    quotationId: "quote-1",
    sourceSnapshot: quotationSnapshot("Delta v1", 70000, "creator-v1"),
  };
  const v2 = {
    id: "q2",
    source: "quotation" as const,
    status: "superseded" as const,
    reviewNumber: 2,
    createdAt: "2026-08-12T00:00:00.000Z",
    firstViewedAt: "2026-08-12T01:00:00.000Z",
    journeyId: "j1",
    quotationId: "quote-1",
    sourceSnapshot: quotationSnapshot("Delta v2", 90000, "creator-v2"),
  };
  const v3 = {
    id: "q3",
    source: "quotation" as const,
    status: "approved" as const,
    reviewNumber: 3,
    createdAt: "2026-08-19T00:00:00.000Z",
    firstViewedAt: "2026-08-19T01:00:00.000Z",
    journeyId: "j1",
    quotationId: "quote-1",
    campaignHeaderId: "campaign-1",
    approvedAt: "2026-08-20T00:00:00.000Z",
    sourceSnapshot: quotationSnapshot("Delta v3", 140000, "creator-v3"),
  };
  const members = [v1, v2, v3];
  const canonicalReviewId = journeyCanonicalReviewId(members, "q1");
  assert.equal(canonicalReviewId, "q1");

  const openedV2 = pickActiveDecisionReview({
    reviews: members,
    requestedReviewId: "q2",
    canonicalReviewId,
    tokenBoundReviewId: "q2",
  });
  assert.equal(openedV2.historical, true);
  assert.equal(openedV2.review?.id, "q2");
  assert.equal(openedV2.review?.sourceSnapshot?.campaignName, "Delta v2");

  const historicalJourney = projectClientJourney({
    members,
    viewed: openedV2.review!,
    historical: true,
    canonicalReviewId,
  });
  assert.equal(historicalJourney.quotationStage, "superseded");
  assert.equal(historicalJourney.quotationStage === "approved", false);
  assert.equal(historicalJourney.campaignStarted, false);
  assert.equal(historicalJourney.movedToCampaign, false);
  assert.equal(historicalJourney.campaignHeaderId, null);
  assert.equal(historicalJourney.canApproveQuotation, false);
  assert.equal(
    approvalWorkspaceKind({
      historical: true,
      quotationStage: historicalJourney.quotationStage,
      canApproveShortlist: false,
      canApproveQuotation: false,
    }),
    "historical"
  );
  assert.equal(
    canMutateClientReviewFromBoundReview({
      reviews: members,
      boundReviewId: "q2",
      canonicalReviewId,
    }),
    false
  );

  const openedCanonical = pickActiveDecisionReview({
    reviews: members,
    requestedReviewId: "q1",
    canonicalReviewId,
  });
  assert.equal(openedCanonical.historical, false);
  assert.equal(openedCanonical.review?.id, "q3");

  const currentJourney = projectClientJourney({
    members,
    viewed: openedCanonical.review!,
    historical: false,
    canonicalReviewId,
  });
  assert.equal(currentJourney.quotationStage, "approved");
  assert.equal(currentJourney.campaignStarted, true);
  assert.equal(currentJourney.canApproveQuotation, false);
  assert.equal(
    approvalWorkspaceKind({
      historical: false,
      quotationStage: currentJourney.quotationStage,
      canApproveShortlist: currentJourney.canApproveShortlist,
      canApproveQuotation: currentJourney.canApproveQuotation,
    }),
    "quotation_approved"
  );
  assert.equal(
    reviewIdBelongsToJourney("q2", {
      canonicalReviewId,
      memberReviewIds: ["q1", "q2", "q3"],
      activeReviewId: "q3",
    }),
    true
  );
});

test("quotation-first current journey still uses the latest quotation review", () => {
  const first = {
    id: "q1",
    source: "quotation" as const,
    status: "superseded" as const,
    reviewNumber: 1,
    createdAt: "2026-08-02T00:00:00.000Z",
    journeyId: "j1",
    quotationId: "quote-1",
  };
  const next = {
    id: "q2",
    source: "quotation" as const,
    status: "awaiting_review" as const,
    reviewNumber: 2,
    createdAt: "2026-08-03T00:00:00.000Z",
    firstViewedAt: null,
    journeyId: "j1",
    quotationId: "quote-1",
  };
  assert.equal(journeyCanonicalReviewId([first, next], "q1"), "q1");
  const current = pickActiveDecisionReview({
    reviews: [first, next],
    requestedReviewId: "q1",
    canonicalReviewId: "q1",
  });
  assert.equal(current.historical, false);
  assert.equal(current.review?.id, "q2");
  const journey = projectClientJourney({
    members: [first, next],
    viewed: current.review!,
    historical: false,
    canonicalReviewId: "q1",
  });
  assert.equal(journey.quotationStage, "sent_for_approval");
  assert.equal(journey.canApproveQuotation, true);
  assert.equal(journey.historical, false);
  assert.equal(
    deriveQuotationStage({
      quotationExists: true,
      review: { status: "superseded", firstViewedAt: null },
      priorApprovedReview: false,
      movedToCampaign: true,
    }),
    "superseded"
  );
});

test("moving a creator to quotation keeps the client shortlist pool", () => {
  const shortlist = [
    { creatorId: "a", displayName: "Mahmoud Faisal" },
    { creatorId: "b", displayName: "Sarah" },
    { creatorId: "c", displayName: "Omar" },
  ];
  const quotation = [
    {
      creatorId: "a",
      displayName: "Mahmoud Faisal",
      investmentAmount: 78_571,
      deliverables: "2 Reels + 3 Stories",
    },
  ];
  const merged = overlayQuotationOnShortlistCreators(shortlist, quotation);
  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.map((creator) => creator.creatorId),
    ["a", "b", "c"]
  );
  assert.equal(merged[0]?.investmentAmount, 78_571);
  assert.equal(merged[0]?.deliverables, "2 Reels + 3 Stories");
  assert.equal(merged[0]?.quotationEligible, true);
  assert.equal(merged[1]?.investmentAmount, undefined);
  assert.equal(merged[1]?.quotationEligible, false);
});

test("internal client-facing price and deliverables appear on the client shortlist card", () => {
  const snapshot = mergeSnapshotsForClientView({
    historical: false,
    active: parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "Summer",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: [
        {
          creatorId: "a",
          displayName: "Mahmoud",
          investmentAmount: 78_571,
          deliverables: "2 Reels + 3 Stories",
        },
      ],
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 78_571, totalInvestment: 78_571, lines: [], selectedCount: 1, totalCount: 1 },
      creatorIds: ["a"],
    })!,
    shortlist: parseSourceSnapshot({
      source: "shortlist",
      brandName: "Acme",
      campaignName: "Summer",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: [
        { creatorId: "a", displayName: "Mahmoud", fitExplanation: "Strong campaign fit" },
        { creatorId: "b", displayName: "Sarah" },
      ],
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 0, totalInvestment: 0, lines: [], selectedCount: 0, totalCount: 2 },
      creatorIds: ["a", "b"],
    }),
    quotation: parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "Summer",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: [
        {
          creatorId: "a",
          displayName: "Mahmoud",
          investmentAmount: 78_571,
          deliverables: "2 Reels + 3 Stories",
        },
      ],
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 78_571, totalInvestment: 78_571, lines: [], selectedCount: 1, totalCount: 1 },
      creatorIds: ["a"],
    }),
  });
  assert.equal(snapshot.creators.length, 2);
  assert.equal(snapshot.creators[0]?.investmentAmount, 78_571);
  assert.equal(snapshot.creators[0]?.deliverables, "2 Reels + 3 Stories");
  assert.equal(snapshot.creators[0]?.fitExplanation, "Strong campaign fit");
  assert.equal(clientFacingObjectIsSafe(snapshot.creators), true);
});

test("Thinkway approval is not client selection", () => {
  assert.equal(thinkwayStatusFromInternal("approved"), "approved");
  assert.equal(thinkwayStatusFromInternal("under_review"), "recommended");
  assert.equal(shortlistStatusToClient("approved"), "in_review");
  assert.equal(
    clientStatusDisplay({ selection: "in_review", selectionConfirmed: false, commerciallyApproved: false }),
    "Not selected"
  );
  assert.equal(
    clientStatusDisplay({ selection: "accepted", selectionConfirmed: false, commerciallyApproved: false }),
    "Selected"
  );
  assert.equal(
    clientStatusDisplay({ selection: "accepted", selectionConfirmed: true, commerciallyApproved: false }),
    "Client Approved"
  );
  assert.equal(
    clientStatusDisplay({ selection: "accepted", selectionConfirmed: true, commerciallyApproved: true }),
    "Commercially approved"
  );
});

test("client can select priced and unpriced creators; calculator counts priced only", () => {
  const creators = [
    { creatorId: "priced", displayName: "A", investmentAmount: 50_000 },
    { creatorId: "pending", displayName: "B" },
  ];
  const selection = { priced: "accepted" as const, pending: "accepted" as const };
  const calc = selectionCalculator(creators, selection);
  assert.equal(isPricedClientInvestment(50_000), true);
  assert.equal(isPricedClientInvestment(undefined), false);
  assert.equal(calc.selectedCount, 2);
  assert.equal(calc.pricedSelectedCount, 1);
  assert.equal(calc.unpricedSelectedCount, 1);
  assert.equal(calc.pricedInvestment, 50_000);
  assert.match(calc.unpricedMessage ?? "", /remain in your selection/i);
  const commercial = projectCommercialFromSnapshot(
    parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "Summer",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators,
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 50_000, totalInvestment: 50_000, lines: [], selectedCount: 2, totalCount: 2 },
      creatorIds: ["priced", "pending"],
    })!,
    selection
  );
  assert.equal(commercial.totalInvestment, 50_000);
  assert.equal(commercial.selectedCount, 2);
  assert.equal(commercial.pricedSelectedCount, 1);
  assert.equal(commercial.unpricedSelectedCount, 1);
});

test("unpriced selected creators do not block final quotation approval when priced creators exist", () => {
  const creators = [
    { creatorId: "priced", investmentAmount: 80_000 },
    { creatorId: "pending" },
  ];
  const selection = { priced: "accepted" as const, pending: "accepted" as const };
  const calc = selectionCalculator(creators, selection);
  assert.equal(
    canApproveFinalQuotation({
      historical: false,
      quotationInteractive: true,
      selectionConfirmed: true,
      selectedCount: calc.selectedCount,
      unpricedSelectedCount: calc.unpricedSelectedCount,
    }),
    true
  );
  assert.equal(calc.unpricedSelectedCount, 1);
  assert.equal(calc.pricedSelectedCount, 1);
});

test("Confirm Creators does not approve the quotation", () => {
  const sideEffects = confirmCreatorsDoesNotApproveQuotation();
  assert.equal(sideEffects.lockCommercial, false);
  assert.equal(sideEffects.setQuotationStatusApproved, false);
  const quotationApprove = clientApprovalSideEffects("quotation", "approved");
  assert.equal(quotationApprove.setQuotationStatusApproved, true);
  assert.equal(quotationApprove.lockCommercial, true);
  assert.equal(
    canConfirmCreators({
      historical: false,
      interactive: true,
      selectedCount: 2,
      selectionConfirmed: false,
    }),
    true
  );
  assert.equal(
    canConfirmCreators({
      historical: false,
      interactive: true,
      selectedCount: 2,
      selectionConfirmed: true,
    }),
    false
  );
});

test("commercial total reflects selected priced creators only", () => {
  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme",
    platforms: [],
    deliverables: [],
    creators: [
      { creatorId: "a", displayName: "Mahmoud", investmentAmount: 78_571 },
      { creatorId: "b", displayName: "Sarah", investmentAmount: 65_000 },
      { creatorId: "c", displayName: "Omar", investmentAmount: 50_000 },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 193_571, totalInvestment: 193_571, lines: [], selectedCount: 3, totalCount: 3 },
    creatorIds: ["a", "b", "c"],
  })!;
  const commercial = projectCommercialFromSnapshot(snapshot, {
    a: "accepted",
    b: "accepted",
    c: "in_review",
  });
  assert.equal(commercial.totalInvestment, 143_571);
  assert.equal(commercial.selectedCount, 2);
  assert.equal(commercial.lines.every((line) => !/cost|gp|margin/i.test(line.label)), true);
});

test("vendor cost never appears on client-facing snapshot fields", () => {
  const creator = parseSnapshotCreator({
    creatorId: "a",
    displayName: "Mahmoud",
    investmentAmount: 78_571,
    fitExplanation: "Strong audience alignment with Egyptian consumers.",
  });
  assert.equal(clientFacingObjectIsSafe(creator), true);
  assert.equal(clientFacingObjectIsSafe({ investmentAmount: 10, vendorCost: 4 }), false);
  assert.equal(clientFacingObjectIsSafe({ gp: 2, margin: 0.4 }), false);
  assert.equal("vendorCost" in creator, false);
  assert.equal("gp" in creator, false);
  assert.equal("margin" in creator, false);
});

test("confirmed selection freeze does not silently remove unpriced creators", () => {
  const blocked = selectionChangeAllowed({
    selectionConfirmed: true,
    commerciallyApproved: false,
    current: "accepted",
    next: "in_review",
    priced: false,
  });
  assert.equal(blocked.ok, false);
  const blockedPriced = selectionChangeAllowed({
    selectionConfirmed: true,
    commerciallyApproved: false,
    current: "in_review",
    next: "accepted",
    priced: true,
  });
  assert.equal(blockedPriced.ok, false);
});

test("selection journey flags require confirm before final quotation approval", () => {
  const flags = selectionJourneyFlags({
    historical: false,
    interactive: true,
    quotationInteractive: true,
    selectionConfirmed: false,
    selectedCount: 3,
    unpricedSelectedCount: 0,
    approvedQuotationCount: 1,
  });
  assert.equal(flags.canConfirmCreators, true);
  assert.equal(flags.canApproveFinalQuotation, false);
  const ready = selectionJourneyFlags({
    historical: false,
    interactive: true,
    quotationInteractive: true,
    selectionConfirmed: true,
    selectedCount: 3,
    unpricedSelectedCount: 0,
    approvedQuotationCount: 1,
  });
  assert.equal(ready.canConfirmCreators, false);
  assert.equal(ready.canApproveFinalQuotation, true);
});

test("consolidation contract is available for multiple approved quotations without a second commercial engine", () => {
  const contract = consolidationContract(2);
  assert.equal(contract.eligible, true);
  assert.equal(contract.actionLabel, "Consolidate selections");
  assert.match(contract.helper, /new quotation version/i);
  assert.equal(consolidationContract(1).eligible, false);
});

test("historical merged snapshots stay frozen and do not overlay later quotation prices", () => {
  const historical = mergeSnapshotsForClientView({
    historical: true,
    active: parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "v1",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: [{ creatorId: "a", displayName: "A", investmentAmount: 50_000 }],
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 50_000, totalInvestment: 50_000, lines: [], selectedCount: 1, totalCount: 1 },
      creatorIds: ["a"],
    })!,
    quotation: parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "v2",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: [{ creatorId: "a", displayName: "A", investmentAmount: 60_000 }],
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 60_000, totalInvestment: 60_000, lines: [], selectedCount: 1, totalCount: 1 },
      creatorIds: ["a"],
    }),
  });
  assert.equal(historical.campaignName, "v1");
  assert.equal(historical.creators[0]?.investmentAmount, 50_000);
});

test("approved quotation with zero selected creators is not a valid commercial outcome", () => {
  assert.equal(
    isValidClientCommercialApproval({ quotationStage: "approved", selectedCount: 0 }),
    false
  );
  assert.equal(
    isValidClientCommercialApproval({ quotationStage: "approved", selectedCount: 2 }),
    true
  );
  assert.equal(
    commercialStageCopy({
      quotationStage: "approved",
      selectedCount: 0,
      pricedSelectedCount: 0,
      pricedInvestment: 0,
      currency: "AED",
      selectionConfirmed: false,
      hasAnyPrice: true,
    }).label,
    "Selection required"
  );
  assert.equal(
    campaignStageCopy({ campaignStarted: false, commerciallyApproved: false }).label,
    "Not started"
  );
  assert.equal(
    approvalWorkspaceKind({
      historical: false,
      quotationStage: "approved",
      canApproveShortlist: false,
      canApproveQuotation: false,
      selectedCount: 0,
    }),
    "idle"
  );
  assert.match(
    journeyActionRequired({
      shortlistStage: "sent",
      quotationStage: "approved",
      historical: false,
      selectedCount: 0,
    }),
    /no client-selected creators/
  );
});

test("quotation overlay uses quotation currency and service description as client-facing deliverables", () => {
  const merged = overlayQuotationOnShortlistCreators(
    [
      { creatorId: "a", displayName: "Liwa creator", investmentCurrency: "EGP" },
      { creatorId: "b", displayName: "Pool only" },
    ],
    [
      {
        creatorId: "a",
        displayName: "Liwa creator",
        investmentAmount: 45_000,
        investmentCurrency: "EGP",
        deliverables: "Price for Visit & Story & Reel",
      },
    ],
    { currency: "AED" }
  );
  assert.equal(merged[0]?.investmentCurrency, "AED");
  assert.equal(merged[0]?.deliverables, "Price for Visit & Story & Reel");
  assert.equal(merged[0]?.investmentAmount, 45_000);
  assert.equal(merged[1]?.investmentCurrency, "AED");
  const projected = projectCommercialFromSnapshot(
    parseSourceSnapshot({
      source: "quotation",
      brandName: "Liwa",
      campaignName: "Festival",
      clientLabel: "Liwa",
      platforms: [],
      deliverables: [],
      creators: merged,
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "AED", creatorInvestment: 45_000, totalInvestment: 45_000, lines: [], selectedCount: 0, totalCount: 2 },
      creatorIds: ["a", "b"],
    })!,
    { a: "in_review", b: "in_review" }
  );
  assert.equal(projected.selectedCount, 0);
  assert.equal(projected.totalInvestment, 0);
  assert.equal(projected.currency, "AED");
});

test("legacy content and quotation URLs map into the primary journey", () => {
  assert.equal(resolveClientWorkspaceSection("content"), "shortlist");
  assert.equal(resolveClientWorkspaceSection("quotation"), "commercial");
  assert.equal(resolveClientWorkspaceSection("creators"), "creators");
  assert.equal(resolveClientWorkspaceSection("overview"), "overview");
  assert.equal(resolveClientWorkspaceSection("shortlist"), "shortlist");
  assert.equal(resolveClientWorkspaceSection("feedback"), "feedback");
  const visible = [...CLIENT_WORKSPACE_JOURNEY_SECTIONS];
  assert.equal(isRenderableClientWorkspaceSection("feedback", visible), true);
  assert.equal(isRenderableClientWorkspaceSection("overview", visible), true);
  assert.equal(isRenderableClientWorkspaceSection("shortlist", visible), true);
});

test("snapshot deliverable items keep quotation type_lines", () => {
  const creator = parseSnapshotCreator({
    creatorId: "a",
    displayName: "A",
    deliverableItems: [
      { platform: "instagram", type_lines: [{ type: "reel", quantity: 2 }, { type: "story", quantity: 3 }] },
    ],
  });
  assert.equal(creator.deliverableItems?.length, 2);
  assert.equal(creator.deliverableItems?.[0]?.type, "reel");
  assert.equal(creator.deliverableItems?.[0]?.quantity, 2);
});

function shortlistCreator(id: string, extra: Record<string, unknown> = {}) {
  return {
    creatorId: id,
    displayName: id,
    ...extra,
  };
}

test("A: quotation overlay keeps the full shortlist pool", () => {
  const overlay = overlayQuotationOnShortlistCreators(
    [
      shortlistCreator("pool-1", { displayName: "Ahmed", influencerId: "inf-1" }),
      shortlistCreator("pool-2", { displayName: "Nourhanne", influencerId: "inf-2" }),
      shortlistCreator("pool-3", { displayName: "Farah", influencerId: "inf-3" }),
    ],
    [
      {
        creatorId: "quote-line-1",
        displayName: "Ahmed",
        influencerId: "inf-1",
        quotationEligible: true,
        investmentAmount: 24_000,
        investmentCurrency: "EGP",
        deliverables: "1× IG Story",
      },
    ],
    { currency: "EGP" }
  );
  assert.equal(overlay.length, 3);
  assert.equal(overlay[0]!.quotationEligible, true);
  assert.equal(overlay[0]!.investmentAmount, 24_000);
  assert.equal(overlay[1]!.quotationEligible, false);
  assert.equal(overlay[1]!.investmentAmount, undefined);
});

test("B/C: overlay shows quotation price and exact deliverables", () => {
  const overlay = overlayQuotationOnShortlistCreators(
    [shortlistCreator("pool-1", { influencerId: "inf-1" })],
    [
      {
        creatorId: "qi-1",
        displayName: "Ahmed",
        influencerId: "inf-1",
        investmentAmount: 24_000,
        investmentCurrency: "EGP",
        deliverables: "1× IG Story",
        deliverableItems: [{ platform: "instagram", type: "story", quantity: 1 }],
        serviceDescription: "1× IG Story with boosting",
      },
    ],
    { currency: "EGP" }
  );
  assert.equal(overlay[0]!.investmentAmount, 24_000);
  assert.equal(overlay[0]!.deliverables, "1× IG Story");
  assert.equal(overlay[0]!.serviceDescription, "1× IG Story with boosting");
  assert.equal(isPricedClientInvestment(overlay[0]!.investmentAmount), true);
});

test("D: historical snapshots stay frozen while current overlay updates", () => {
  const frozen = parseSourceSnapshot({
    source: "shortlist",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme",
    platforms: [],
    deliverables: [],
    whyThisApproach: "",
    creators: [{ creatorId: "a", displayName: "A", investmentAmount: 10_000 }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 10_000, totalInvestment: 10_000 },
  });
  const later = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme",
    platforms: [],
    deliverables: [],
    whyThisApproach: "",
    creators: [{ creatorId: "a", displayName: "A", investmentAmount: 99_000 }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 99_000, totalInvestment: 99_000 },
  });
  const historical = mergeSnapshotsForClientView({
    active: frozen!,
    shortlist: frozen,
    quotation: later,
    historical: true,
  });
  const current = mergeSnapshotsForClientView({
    active: frozen!,
    shortlist: frozen,
    quotation: later,
    historical: false,
  });
  assert.equal(historical.creators[0]!.investmentAmount, 10_000);
  assert.equal(current.creators[0]!.investmentAmount, 99_000);
});

test("E: removing a quotation price shows Pricing required and drops calculator investment", () => {
  const priced = overlayQuotationOnShortlistCreators(
    [shortlistCreator("a", { influencerId: "inf-1" })],
    [{ creatorId: "qi", displayName: "A", influencerId: "inf-1", investmentAmount: 24_000 }],
    { currency: "EGP" }
  );
  const unpriced = overlayQuotationOnShortlistCreators(
    [shortlistCreator("a", { influencerId: "inf-1" })],
    [{ creatorId: "qi", displayName: "A", influencerId: "inf-1", investmentAmount: 0 }],
    { currency: "EGP" }
  );
  assert.equal(isPricedClientInvestment(priced[0]!.investmentAmount), true);
  assert.equal(investmentDisplayLabel(unpriced[0]!.investmentAmount), PRICE_PENDING_LABEL);
  const calc = selectionCalculator(unpriced.map((creator) => ({
    ...creator,
    selection: "accepted" as const,
    contentExamples: [],
  })), { a: "accepted" });
  assert.equal(calc.pricedSelectedCount, 0);
  assert.equal(calc.pricedInvestment, 0);
  assert.equal(calc.unpricedSelectedCount, 1);
});

test("F: removing a creator from quotation clears overlay and keeps the shortlist card", () => {
  const overlay = overlayQuotationOnShortlistCreators(
    [
      shortlistCreator("pool-1", { influencerId: "inf-1", displayName: "Ahmed" }),
      shortlistCreator("pool-2", { influencerId: "inf-2", displayName: "Nourhanne" }),
    ],
    [
      {
        creatorId: "qi-2",
        displayName: "Nourhanne",
        influencerId: "inf-2",
        investmentAmount: 48_000,
        deliverables: "1× IG Reel",
      },
    ],
    { currency: "EGP" }
  );
  assert.equal(overlay.length, 2);
  assert.equal(overlay[0]!.quotationEligible, false);
  assert.equal(overlay[0]!.investmentAmount, undefined);
  assert.equal(overlay[1]!.quotationEligible, true);
  assert.equal(overlay[1]!.investmentAmount, 48_000);
});

test("G: Client Workspace converts original AED into quotation SAR via commercial FX", () => {
  const price = clientFacingQuotationPrice({
    revenue: 24_000,
    revenueEgp: 312_000,
    costCurrency: "AED",
    lineFxRateToEgp: 13,
    quotationCurrency: "SAR",
    quotationFxRateToEgp: 12.5,
  });
  assert.equal(price.currency, "SAR");
  assert.equal(price.amount, convertLineRevenueToQuotationCurrency({
    revenue: 24_000,
    revenueEgp: 312_000,
    lineFxRateToEgp: 13,
    quotationCurrency: "SAR",
    quotationFxRateToEgp: 12.5,
  }));
  assert.equal(price.originalAmount, 24_000);
  assert.equal(price.originalCurrency, "AED");
  const original = originalInvestmentForDisplay(
    { originalInvestmentAmount: price.originalAmount, originalInvestmentCurrency: price.originalCurrency },
    "SAR"
  );
  assert.deepEqual(original, { amount: 24_000, currency: "AED" });
  const calc = selectionCalculator(
    [
      {
        creatorId: "a",
        displayName: "A",
        investmentAmount: price.amount,
        investmentCurrency: "SAR",
        selection: "accepted",
        contentExamples: [],
      },
    ],
    { a: "accepted" }
  );
  assert.equal(calc.pricedInvestment, price.amount);
});

test("H: same currency does not show an original-currency line", () => {
  const price = clientFacingQuotationPrice({
    revenue: 24_000,
    revenueEgp: 24_000,
    costCurrency: "EGP",
    lineFxRateToEgp: 1,
    quotationCurrency: "EGP",
    quotationFxRateToEgp: 1,
  });
  assert.equal(price.amount, 24_000);
  assert.equal(price.currency, "EGP");
  assert.equal(price.originalAmount, undefined);
  assert.equal(
    originalInvestmentForDisplay(
      { originalInvestmentAmount: price.originalAmount, originalInvestmentCurrency: price.originalCurrency },
      "EGP"
    ),
    null
  );
});

test("I: bulk Approve Selected Creators does not approve the quotation", () => {
  assert.equal(APPROVE_SELECTED_CREATORS_LABEL, "Approve Selected Creators");
  assert.equal(CONFIRM_CREATORS_LABEL, APPROVE_SELECTED_CREATORS_LABEL);
  const sideEffects = confirmCreatorsDoesNotApproveQuotation();
  assert.equal(sideEffects.setQuotationStatusApproved, false);
  assert.equal(sideEffects.lockCommercial, false);
});

test("J: Thinkway approval does not create client selection", () => {
  assert.equal(thinkwayStatusFromInternal("approved"), "approved");
  assert.equal(thinkwayStatusLabel("approved"), "Thinkway Approved");
  assert.equal(clientStatusDisplay({ selection: "in_review", selectionConfirmed: false, commerciallyApproved: false }), "Not selected");
  assert.notEqual(thinkwayStatusLabel("approved"), CLIENT_APPROVED_LABEL);
});

test("K: vendor cost and GP never appear on client-facing overlay", () => {
  const overlay = overlayQuotationOnShortlistCreators(
    [shortlistCreator("a", { influencerId: "inf-1" })],
    [
      {
        creatorId: "qi",
        displayName: "A",
        influencerId: "inf-1",
        investmentAmount: 24_000,
      },
    ],
    { currency: "EGP" }
  );
  const json = JSON.stringify(overlay);
  assert.equal(/vendor cost|gross profit|\bGP\b|margin/i.test(json), false);
  assert.equal("cost" in overlay[0]!, false);
  assert.equal("gp_pct" in overlay[0]!, false);
});

test("overlay matches shortlist item ids when quotation line ids differ", () => {
  const overlay = overlayQuotationOnShortlistCreators(
    [shortlistCreator("unified-1", { shortlistItemId: "sl-item-9", displayName: "Ahmed" })],
    [
      {
        creatorId: "quotation-line-uuid",
        displayName: "Ahmed El Badawy",
        shortlistItemId: "sl-item-9",
        investmentAmount: 24_000,
        deliverables: "1× IG Story",
      },
    ],
    { currency: "EGP" }
  );
  assert.equal(overlay[0]!.investmentAmount, 24_000);
  assert.equal(overlay[0]!.deliverables, "1× IG Story");
  assert.equal(overlay[0]!.quotationEligible, true);
});

test("quotation fingerprint includes prices and deliverables", () => {
  const fingerprint = fingerprintFromSnapshotCreators([
    { creatorId: "a", displayName: "A", investmentAmount: 24_000, deliverables: "1× IG Story" },
    { creatorId: "b", displayName: "B", investmentAmount: 0, deliverables: "" },
  ]);
  assert.deepEqual((fingerprint.revenues as Record<string, number>).a, 24_000);
  assert.equal((fingerprint.deliverables as Record<string, string>).a, "1× IG Story");
});

test("quotation item overlay converts line revenue into quotation currency", () => {
  const overlay = overlayQuotationDetailOnCreators(
    [{ creatorId: "unified-1", displayName: "Ahmed", influencerId: "inf-1" }],
    [
      {
        id: "qi-1",
        influencer_id: "inf-1",
        profile_id: null,
        unified_id: "unified-1",
        source_shortlist_item_id: "sl-1",
        creator_name: "Ahmed El Badawy",
        platform: "instagram",
        handle: "@ahmed",
        followers: 1000,
        engagement_rate: 2,
        country_code: "EG",
        deliverables: [{ platform: "instagram", type: "story", quantity: 1 }],
        profile_image_url: null,
        profile_url: null,
        option_number: 1,
        service_description: "1× IG Story",
        commercial_input_mode: "cost_revenue",
        cost: 0,
        cost_currency: "EGP",
        revenue: 24_000,
        gp_pct: 0,
        gp_value: 0,
        fx_rate_to_egp: 1,
        cost_egp: 0,
        revenue_egp: 24_000,
        gp_value_egp: 0,
        af_pct: 0,
        af_value: 0,
        af_value_egp: 0,
        sort_order: 0,
        collapse_group_id: null,
        collapse_label: null,
      },
    ],
    "SAR",
    12.5
  );
  assert.equal(overlay[0]!.investmentCurrency, "SAR");
  assert.equal(overlay[0]!.investmentAmount, 1920);
  assert.equal(overlay[0]!.originalInvestmentAmount, 24_000);
  assert.equal(overlay[0]!.originalInvestmentCurrency, "EGP");
  assert.match(overlay[0]!.deliverables ?? "", /Story/i);
  assert.equal(overlay[0]!.serviceDescription, "1× IG Story");
});

test("quotation card description uses the deliverable service description column", () => {
  assert.equal(
    clientServiceDescriptionFromQuotationItem({
      service_description: null,
      deliverables: [{ service_description: "1× IG Story with boosting" }],
    }),
    "1× IG Story with boosting"
  );
  assert.equal(
    clientServiceDescriptionFromQuotationItem({
      service_description: "Line fallback",
      deliverables: [{ service_description: null }],
    }),
    "Line fallback"
  );
  const overlay = overlayQuotationDetailOnCreators(
    [{ creatorId: "unified-1", displayName: "Nourhanne", influencerId: "inf-1" }],
    [
      {
        id: "qi-1",
        influencer_id: "inf-1",
        profile_id: null,
        unified_id: "unified-1",
        source_shortlist_item_id: "sl-1",
        creator_name: "Nourhanne Eissa",
        platform: "instagram",
        handle: "@nourhanne",
        followers: 1000,
        engagement_rate: 2,
        country_code: "EG",
        deliverables: [
          {
            platform: "instagram",
            type: "story",
            quantity: 1,
            service_description: "1× IG Story with boosting",
          },
        ],
        profile_image_url: null,
        profile_url: null,
        option_number: 1,
        service_description: null,
        commercial_input_mode: "cost_revenue",
        cost: 0,
        cost_currency: "EGP",
        revenue: 720_000,
        gp_pct: 0,
        gp_value: 0,
        fx_rate_to_egp: 1,
        cost_egp: 0,
        revenue_egp: 720_000,
        gp_value_egp: 0,
        af_pct: 0,
        af_value: 0,
        af_value_egp: 0,
        sort_order: 0,
        collapse_group_id: null,
        collapse_label: null,
      },
    ],
    "EGP",
    1
  );
  assert.equal(overlay[0]!.serviceDescription, "1× IG Story with boosting");
  assert.equal(
    clientCreatorCardDescription(overlay[0]!),
    "1× IG Story with boosting"
  );
});

test("Approve Selected Creators is enabled for priced and unpriced selections", () => {
  const pricedGate = {
    historical: false,
    interactive: true,
    selectedCount: 2,
    unpricedSelectedCount: 0,
    selectionConfirmed: false,
  };
  assert.equal(canEnableApproveSelectedCreators(pricedGate), true);
  assert.equal(canEnableApproveSelectedCreators({ ...pricedGate, unpricedSelectedCount: 1 }), true);
  assert.equal(canEnableApproveSelectedCreators({ ...pricedGate, selectedCount: 0 }), false);
  assert.equal(canEnableApproveSelectedCreators({ ...pricedGate, selectionConfirmed: true }), false);
  const calc = selectionCalculator(
    [
      { creatorId: "a", investmentAmount: 24_000 },
      { creatorId: "b" },
    ],
    { a: "accepted", b: "accepted" }
  );
  assert.equal(calc.unpricedSelectedCount, 1);
  assert.match(calc.unpricedMessage ?? "", /remain in your selection/i);
});

test("bulk approval freeze uses clientSelection and keeps Thinkway status separate", () => {
  const snapshot = parseSourceSnapshot({
    source: "quotation",
    brandName: "Acme",
    campaignName: "Summer",
    clientLabel: "Acme",
    platforms: [],
    deliverables: [],
    creators: [
      { creatorId: "a", displayName: "Ahmed", investmentAmount: 24_000, deliverables: "1× IG Story", thinkwayStatus: "approved" },
      { creatorId: "b", displayName: "Farah", investmentAmount: 5_500, deliverables: "1× TT Video" },
      { creatorId: "c", displayName: "Pool", investmentAmount: 9_000 },
    ],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 38_500, totalInvestment: 38_500 },
    clientSelection: { confirmedAt: "2026-08-21T10:00:00.000Z", creatorIds: ["a", "b"] },
  })!;
  const commercial = projectCommercialFromSnapshot(snapshot, {
    a: "accepted",
    b: "accepted",
    c: "accepted",
  });
  assert.equal(commercial.selectedCount, 2);
  assert.equal(commercial.totalInvestment, 29_500);
  assert.deepEqual(
    commercial.lines.map((line) => line.label).sort(),
    ["Ahmed", "Farah"]
  );
  assert.equal(clientStatusDisplay({ selection: "accepted", selectionConfirmed: true, commerciallyApproved: false }), CLIENT_APPROVED_LABEL);
  assert.equal(thinkwayStatusLabel("approved"), "Thinkway Approved");
  assert.notEqual(CLIENT_APPROVED_LABEL, thinkwayStatusLabel("approved"));
  const roster = creatorsForClientCommercial(snapshot.creators, { a: "accepted", b: "accepted", c: "in_review" }, snapshot.clientSelection?.creatorIds);
  assert.deepEqual(roster.map((creator) => creator.creatorId), ["a", "b"]);
});

test("unpriced creators remain selected and Approve Selected Creators stays enabled", () => {
  const creators = [
    { creatorId: "a", investmentAmount: 24_000 },
    { creatorId: "b" },
  ];
  const mixed = selectionCalculator(creators, { a: "accepted", b: "accepted" });
  assert.equal(
    canEnableApproveSelectedCreators({
      historical: false,
      interactive: true,
      selectedCount: mixed.selectedCount,
      unpricedSelectedCount: mixed.unpricedSelectedCount,
      selectionConfirmed: false,
    }),
    true
  );
  assert.equal(mixed.unpricedSelectedCount, 1);
  assert.equal(mixed.selectedCount, 2);
});

test("canonical Client Workspace defaults to Shortlist", () => {
  const visible = visibleClientWorkspaceSections({
    review: { source: "shortlist" },
    creators: [{ creatorId: "a" }],
    content: [],
    timeline: { durationWeeks: null, durationLabel: "", phases: [] },
    commercial: { currency: "EGP", creatorInvestment: 0, totalInvestment: 0, lines: [], selectedCount: 0, totalCount: 0 },
    quotation: undefined,
    strategyBody: undefined,
  } as never);
  assert.equal(defaultClientWorkspaceSection(visible), "shortlist");
  assert.notEqual(defaultClientWorkspaceSection(visible), "overview");
  assert.notEqual(defaultClientWorkspaceSection(visible), "creators");
  assert.notEqual(defaultClientWorkspaceSection(visible), "commercial");
});

test("Overview remains the last accessible nav tab and is not a journey stage", () => {
  const visible = [...CLIENT_WORKSPACE_JOURNEY_SECTIONS];
  assert.deepEqual(visible, ["shortlist", "creators", "commercial", "approval", "overview"]);
  assert.equal(visible.at(-1), "overview");
  assert.equal(isRenderableClientWorkspaceSection("overview", visible), true);
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL.overview, "Overview");
});

test("header Review Your Selection is navigation only and never writes client selection", () => {
  const header = headerSelectionNavigation();
  assert.equal(header.label, REVIEW_YOUR_SELECTION_LABEL);
  assert.equal(header.section, "creators");
  assert.equal(header.writesClientSelection, false);
  assert.equal(header.freezesSelection, false);
  assert.equal(header.approvesCreators, false);
  assert.equal(header.approvesQuotation, false);
  assert.notEqual(header.label, APPROVE_SELECTED_CREATORS_LABEL);
  assert.notEqual(header.label, APPROVE_FINAL_QUOTATION_LABEL);
});

test("calculator Approve Selected Creators is the only creator approval action", () => {
  assert.equal(APPROVE_SELECTED_CREATORS_LABEL, "Approve Selected Creators");
  assert.equal(CONFIRM_CREATORS_LABEL, APPROVE_SELECTED_CREATORS_LABEL);
  const header = headerSelectionNavigation();
  assert.notEqual(header.label, APPROVE_SELECTED_CREATORS_LABEL);
  const beforeApproval = primaryActionForJourney({
    canConfirmCreators: true,
    canApproveFinalQuotation: false,
  });
  assert.equal(beforeApproval.kind, "confirm");
  assert.equal(beforeApproval.label, APPROVE_SELECTED_CREATORS_LABEL);
});

test("after creator approval, Approve Final Quotation remains the commercial approval", () => {
  const afterCreators = primaryActionForJourney({
    canConfirmCreators: false,
    canApproveFinalQuotation: true,
  });
  assert.equal(afterCreators.kind, "approve");
  assert.equal(afterCreators.label, APPROVE_FINAL_QUOTATION_LABEL);
  assert.notEqual(headerSelectionNavigation().label, APPROVE_FINAL_QUOTATION_LABEL);
  const sideEffects = confirmCreatorsDoesNotApproveQuotation();
  assert.equal(sideEffects.setQuotationStatusApproved, false);
});

test("historical review URLs remain version-frozen", () => {
  assert.equal(isFrozenClientReviewStatus("superseded"), true);
  assert.equal(isInteractiveClientReview("superseded"), false);
  assert.equal(isFrozenClientReviewStatus("revoked"), true);
  assert.equal(isInteractiveClientReview("awaiting_review"), true);
});

test("Shortlist is the select page until the client approves the selection", () => {
  assert.equal(
    shortlistCreatorSelectEnabled({ canDecide: true, selectionConfirmed: false }),
    true
  );
  assert.equal(
    shortlistCreatorSelectEnabled({ canDecide: true, selectionConfirmed: true }),
    false
  );
  assert.equal(
    shortlistCreatorSelectEnabled({ canDecide: false, selectionConfirmed: false }),
    false
  );
});

test("Your Selection shows selected creators, then the frozen roster after approval", () => {
  const creators = [
    { creatorId: "a", displayName: "A", selection: "accepted" as const, contentExamples: [] },
    { creatorId: "b", displayName: "B", selection: "in_review" as const, contentExamples: [] },
    { creatorId: "c", displayName: "C", selection: "in_review" as const, contentExamples: [] },
  ];
  const live = yourSelectionRoster(creators as never, { a: "accepted", b: "in_review", c: "in_review" });
  assert.deepEqual(live.map((creator) => creator.creatorId), ["a"]);
  const frozen = yourSelectionRoster(creators as never, { a: "accepted", b: "accepted", c: "in_review" }, {
    selectionConfirmed: true,
    clientApprovedCreatorIds: ["a"],
  });
  assert.deepEqual(frozen.map((creator) => creator.creatorId), ["a"]);
  assert.equal(frozen.some((creator) => creator.creatorId === "b"), false);
});

test("Approve Selected Creators opens Commercial and does not skip ahead before that freeze", () => {
  assert.equal(AFTER_CREATOR_APPROVAL_SECTION, "commercial");
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL[AFTER_CREATOR_APPROVAL_SECTION], "Commercial");
  assert.equal(CLIENT_WORKSPACE_SECTION_LABEL.commercial, "Commercial");
});

const pool = [
  { creatorId: "priced-a", displayName: "A", investmentAmount: 400_000, agencyFeeAmount: 80_000, deliverables: "IG Reel x 1" },
  { creatorId: "priced-b", displayName: "B", investmentAmount: 100_000, agencyFeeAmount: 20_000, deliverables: "IG Story x 3" },
  { creatorId: "open-c", displayName: "C", deliverables: "TT Video x 1" },
];

test("A: select one priced creator", () => {
  const calc = selectionCalculator(pool, { "priced-a": "accepted" });
  assert.equal(calc.selectedCount, 1);
  assert.equal(calc.pricedSelectedCount, 1);
  assert.equal(calc.unpricedSelectedCount, 0);
  assert.equal(calc.pricedInvestment, 400_000);
});

test("B: select one unpriced creator", () => {
  const calc = selectionCalculator(pool, { "open-c": "accepted" });
  assert.equal(calc.selectedCount, 1);
  assert.equal(calc.pricedSelectedCount, 0);
  assert.equal(calc.unpricedSelectedCount, 1);
  assert.equal(calc.totalInvestment, 0);
});

test("C: select multiple priced creators", () => {
  const calc = selectionCalculator(pool, { "priced-a": "accepted", "priced-b": "accepted" });
  assert.equal(calc.pricedSelectedCount, 2);
  assert.equal(calc.pricedInvestment, 500_000);
  assert.equal(calc.agencyFees, 100_000);
  assert.equal(calc.totalInvestment, 600_000);
});

test("D: select multiple unpriced creators", () => {
  const calc = selectionCalculator(
    [...pool, { creatorId: "open-d", displayName: "D" }],
    { "open-c": "accepted", "open-d": "accepted" }
  );
  assert.equal(calc.selectedCount, 2);
  assert.equal(calc.pricedSelectedCount, 0);
  assert.equal(calc.unpricedSelectedCount, 2);
});

test("E: select a mixture of priced and unpriced creators", () => {
  const calc = selectionCalculator(pool, {
    "priced-a": "accepted",
    "priced-b": "accepted",
    "open-c": "accepted",
  });
  assert.equal(calc.selectedCount, 3);
  assert.equal(calc.pricedSelectedCount, 2);
  assert.equal(calc.unpricedSelectedCount, 1);
  assert.equal(calc.pricedInvestment, 500_000);
  assert.equal(calc.agencyFees, 100_000);
  assert.equal(calc.totalInvestment, 600_000);
});

test("F: Select all includes priced AND unpriced creators", () => {
  const all = selectAllCreatorStates(pool.map((creator) => creator.creatorId));
  const calc = selectionCalculator(pool, all);
  assert.equal(all["priced-a"], "accepted");
  assert.equal(all["open-c"], "accepted");
  assert.equal(calc.selectedCount, 3);
  assert.equal(calc.unpricedSelectedCount, 1);
});

test("G: Clear removes all selections", () => {
  const cleared = clearCreatorSelectionStates(pool.map((creator) => creator.creatorId));
  const calc = selectionCalculator(pool, cleared);
  assert.equal(cleared["priced-a"], "in_review");
  assert.equal(cleared["open-c"], "in_review");
  assert.equal(calc.selectedCount, 0);
});

test("H–J: Approve Selected Creators stays enabled for priced, mixed, and unpriced-only selections", () => {
  const gate = { historical: false, interactive: true, selectionConfirmed: false as const };
  assert.equal(canEnableApproveSelectedCreators({ ...gate, selectedCount: 2, unpricedSelectedCount: 0 }), true);
  assert.equal(canEnableApproveSelectedCreators({ ...gate, selectedCount: 3, unpricedSelectedCount: 1 }), true);
  assert.equal(canEnableApproveSelectedCreators({ ...gate, selectedCount: 1, unpricedSelectedCount: 1 }), true);
});

test("K/L: confirmation summary splits priced and unpriced and shows Cost, Agency Fees, Total Investment", () => {
  const summary = buildCreatorApprovalConfirmation(pool, {
    "priced-a": "accepted",
    "priced-b": "accepted",
    "open-c": "accepted",
  });
  assert.deepEqual(summary.priced.map((row) => row.displayName), ["A", "B"]);
  assert.deepEqual(summary.unpriced.map((row) => row.displayName), ["C"]);
  assert.equal(summary.selectedCount, 3);
  assert.equal(summary.pricedCount, 2);
  assert.equal(summary.unpricedCount, 1);
  assert.equal(summary.clientCost, 500_000);
  assert.equal(summary.agencyFees, 100_000);
  assert.equal(summary.totalInvestment, 600_000);
  assert.equal(summary.helper, UNPRICED_INCLUDED_MESSAGE);
  assert.match(summary.unpriced[0]!.deliverables, /TT Video|To be confirmed/i);
});

test("M: commercial total includes ONLY priced selected creators", () => {
  const commercial = projectCommercialFromSnapshot(
    parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "Summer",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: pool,
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 500_000, feeAmount: 100_000, totalInvestment: 600_000, lines: [], selectedCount: 3, totalCount: 3 },
      creatorIds: pool.map((creator) => creator.creatorId),
    })!,
    { "priced-a": "accepted", "priced-b": "accepted", "open-c": "accepted" }
  );
  assert.equal(commercial.creatorInvestment, 500_000);
  assert.equal(commercial.feeAmount, 100_000);
  assert.equal(commercial.totalInvestment, 600_000);
  assert.equal(commercial.unpricedSelectedCount, 1);
});

test("N/O: unpriced selected creators remain visible after approval and are not silently removed", () => {
  const frozen = yourSelectionRoster(pool as never, {
    "priced-a": "accepted",
    "priced-b": "accepted",
    "open-c": "accepted",
  }, {
    selectionConfirmed: true,
    clientApprovedCreatorIds: ["priced-a", "priced-b", "open-c"],
  });
  assert.deepEqual(frozen.map((creator) => creator.creatorId), ["priced-a", "priced-b", "open-c"]);
  assert.equal(isPricedClientInvestment(frozen.find((creator) => creator.creatorId === "open-c")?.investmentAmount), false);
  assert.equal(
    selectionChangeAllowed({
      selectionConfirmed: true,
      commerciallyApproved: false,
      current: "accepted",
      next: "in_review",
      priced: false,
    }).ok,
    false
  );
});

test("P/X: quotation status remains unchanged after Approve Selected Creators", () => {
  const sideEffects = confirmCreatorsDoesNotApproveQuotation();
  assert.equal(sideEffects.setQuotationStatusApproved, false);
  assert.equal(sideEffects.lockCommercial, false);
  assert.notEqual(APPROVE_SELECTED_CREATORS_LABEL, APPROVE_FINAL_QUOTATION_LABEL);
});

test("Q: Thinkway Approved remains separate from Client Approved", () => {
  assert.equal(thinkwayStatusLabel("approved"), "Thinkway Approved");
  assert.equal(CLIENT_APPROVED_LABEL, "Client Approved");
  assert.notEqual(thinkwayStatusLabel("approved"), CLIENT_APPROVED_LABEL);
});

test("R/S: internal price update appears on canonical Client Workspace and does not overwrite historical review", () => {
  const historical = mergeSnapshotsForClientView({
    active: parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "Summer",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: [{ creatorId: "a", displayName: "A", investmentAmount: 10_000 }],
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 10_000, totalInvestment: 10_000 },
    })!,
    quotation: parseSourceSnapshot({
      source: "quotation",
      brandName: "Acme",
      campaignName: "Summer",
      clientLabel: "Acme",
      platforms: [],
      deliverables: [],
      creators: [{ creatorId: "a", displayName: "A", investmentAmount: 99_000 }],
      content: [],
      timeline: { durationWeeks: null, durationLabel: "", phases: [] },
      commercial: { currency: "EGP", creatorInvestment: 99_000, totalInvestment: 99_000 },
    })!,
    historical: true,
  });
  assert.equal(historical.creators[0]!.investmentAmount, 10_000);
  const current = overlayQuotationOnShortlistCreators(
    [{ creatorId: "a", displayName: "A" }],
    [{ creatorId: "a", displayName: "A", investmentAmount: 99_000, agencyFeeAmount: 9_900 }],
    { currency: "EGP" }
  );
  assert.equal(current[0]!.investmentAmount, 99_000);
  assert.equal(current[0]!.agencyFeeAmount, 9_900);
});

test("T/U: quotation currency conversion works and original currency is shown when different", () => {
  const price = clientFacingQuotationPrice({
    revenue: 20_000,
    revenueEgp: 250_000,
    costCurrency: "AED",
    lineFxRateToEgp: 12.5,
    quotationCurrency: "SAR",
    quotationFxRateToEgp: 12.5,
  });
  assert.equal(price.currency, "SAR");
  assert.ok(isPricedClientInvestment(price.amount));
  assert.equal(price.originalAmount, 20_000);
  assert.equal(price.originalCurrency, "AED");
  const same = originalInvestmentForDisplay(
    { originalInvestmentAmount: price.originalAmount, originalInvestmentCurrency: price.originalCurrency },
    "SAR"
  );
  assert.deepEqual(same, { amount: 20_000, currency: "AED" });
});

test("V: Cost + Agency Fees = Total Investment using existing quotation AF math", () => {
  const fee = clientFacingAgencyFeeFromLine({
    afValue: 100_000,
    afPct: 20,
    convertedRevenue: 500_000,
    quotationCurrency: "EGP",
    quotationFxRateToEgp: 1,
  });
  assert.equal(fee, 100_000);
  const calc = selectionCalculator(pool, { "priced-a": "accepted", "priced-b": "accepted" });
  assert.equal(calc.pricedInvestment + calc.agencyFees, calc.totalInvestment);
  assert.equal(calc.totalInvestment, 600_000);
});

test("W: vendor cost / GP / margin never appear client-side", () => {
  const overlay = overlayQuotationOnShortlistCreators(
    [{ creatorId: "a", displayName: "A" }],
    [{ creatorId: "a", displayName: "A", investmentAmount: 24_000, agencyFeeAmount: 2_400 }],
    { currency: "EGP" }
  );
  const json = JSON.stringify(overlay);
  assert.equal(/vendor cost|gross profit|\bGP\b|margin/i.test(json), false);
  assert.equal("cost" in overlay[0]!, false);
  assert.equal(clientFacingObjectIsSafe(overlay[0]), true);
});

test("Y: final quotation approval still opens the existing campaign conversion gate", () => {
  assert.equal(canCreateCampaignFromQuotation("approved"), true);
  assert.equal(canCreateCampaignFromQuotation("sent"), false);
  const quotationApprove = clientApprovalSideEffects("quotation", "approved");
  assert.equal(quotationApprove.setQuotationStatusApproved, true);
});

test("Z: header Review Your Selection is navigation-only", () => {
  const header = headerSelectionNavigation();
  assert.equal(header.label, REVIEW_YOUR_SELECTION_LABEL);
  assert.equal(header.writesClientSelection, false);
  assert.equal(header.approvesQuotation, false);
  assert.notEqual(header.label, APPROVE_SELECTED_CREATORS_LABEL);
});

test("AA: canonical Client Workspace opens on Shortlist", () => {
  assert.equal(defaultClientWorkspaceSection([...CLIENT_WORKSPACE_JOURNEY_SECTIONS]), "shortlist");
});

test("AB: navigation order is Shortlist → Your Selection → Commercial → Campaign → Overview", () => {
  assert.deepEqual([...CLIENT_WORKSPACE_JOURNEY_SECTIONS], [
    "shortlist",
    "creators",
    "commercial",
    "approval",
    "overview",
  ]);
});

test("AC: quotation download and send stay closed until Approve Selected Creators", () => {
  assert.equal(canOpenCommercialWorkspace({ selectionConfirmed: false }), false);
  assert.equal(canOpenCommercialWorkspace({ selectionConfirmed: true }), true);
  assert.equal(canOpenCommercialWorkspace({ historical: true }), true);
  assert.equal(canOpenCommercialWorkspace({ quotationStage: "approved" }), true);
  assert.equal(resolveClientWorkspaceSection("commercial"), "commercial");
  assert.equal(resolveClientWorkspaceSection("quotation"), "commercial");
});

test("AD: client quotation email must be a valid address", () => {
  assert.equal(normalizeClientDeliveryEmail("saved@client.com"), "saved@client.com");
  assert.equal(normalizeClientDeliveryEmail("  extra@client.com  "), "extra@client.com");
  assert.equal(normalizeClientDeliveryEmail("not-an-email"), null);
  assert.equal(normalizeClientDeliveryEmail(""), null);
});


