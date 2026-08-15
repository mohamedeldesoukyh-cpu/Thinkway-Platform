import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { formatMoneyKpi } from "@/lib/finance/currency-format";
import type {
  CreatorsSectionData,
  PresentationStatusSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  getCampaignOutput,
  listCampaignOutputs,
  describeStaleReason,
} from "@/features/campaign-outputs/output-registry";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";
import type {
  CampaignOutputContent,
  CampaignOutputKind,
} from "@/features/campaign-outputs/output-types";

import type { CampaignStudioSectionId } from "../types/campaign-studio";
import type { StudioWorkspaceStepId } from "../constants/studio-workspace";
import { deriveCreatorQuantityRecommendation } from "./creator-quantity";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { deriveInfluencerStrategyView } from "./influencer-strategy-view";
import { resolveBudgetData, resolveTimelineData } from "./section-data-resolver";
import { resolveStudioDiscoverySufficiency } from "./studio-discovery-sufficiency";
import { requiredIntakeFacts } from "./studio-intake-facts";
import { isStudioIntakeConfirmed } from "./studio-workspace-status";

export type StudioPackageCheckId =
  | "intake"
  | "strategy"
  | "discovery"
  | "creators"
  | "content"
  | "commercial"
  | "timeline"
  | "proposal"
  | "presentation";

/** Dimension states — mapped from existing authorities, not a second stored status. */
export type StudioPackageDimensionState =
  | "current"
  | "outdated"
  | "in_progress"
  | "blocked"
  | "ready";

export type StudioPackageOverallState =
  | "blocked"
  | "in_progress"
  | "outdated"
  | "ready_for_internal_review"
  | "ready_for_client";

export type StudioPackageCheck = {
  id: StudioPackageCheckId;
  label: string;
  state: StudioPackageDimensionState;
  ready: boolean;
  reason?: string;
  action?: string;
  fixTarget: StudioWorkspaceStepId;
  attention?: string;
};

export type StudioPackageConsistencyIssue = {
  key: string;
  label: string;
  reason: string;
  fixTarget: StudioWorkspaceStepId;
};

export type StudioPackageSourceState = {
  campaignObjectId?: string;
  updatedAt?: string;
  factsExtractedAt?: string;
  factsConfirmedAt?: string;
  durationWeeks?: number;
  budgetAmount?: number;
  budgetCurrency?: string;
  creatorIds: string[];
  outputVersions: Partial<
    Record<CampaignOutputKind, { version: number; status: string }>
  >;
};

export type StudioPackageDiagnostics = {
  sourceFingerprints: Partial<Record<CampaignOutputKind, string>>;
  discoveryState?: string;
  quantityRecommended: number | null;
  staleOutputKinds: CampaignOutputKind[];
};

export type StudioPackageReadiness = {
  overall: StudioPackageOverallState;
  headline: string;
  attentionSummary?: string;
  checks: StudioPackageCheck[];
  attentionCount: number;
  readyForClient: boolean;
  canCreateClientReview: boolean;
  clientReviewBlockers: string[];
  consistencyIssues: StudioPackageConsistencyIssue[];
  sourceState: StudioPackageSourceState;
  diagnostics: StudioPackageDiagnostics;
};

export const STUDIO_PACKAGE_OVERALL_LABEL: Record<StudioPackageOverallState, string> = {
  blocked: "Not ready",
  in_progress: "Package is in progress",
  outdated: "Not ready",
  ready_for_internal_review: "Ready for internal review",
  ready_for_client: "Ready for client",
};

export const STUDIO_PACKAGE_DIMENSION_LABEL: Record<StudioPackageDimensionState, string> = {
  current: "Current",
  outdated: "Outdated",
  in_progress: "In progress",
  blocked: "Blocked",
  ready: "Ready",
};

export type StudioPackageReadinessOptions = {
  outdatedSections?: ReadonlySet<CampaignStudioSectionId>;
  sectionStatuses?: Partial<Record<CampaignStudioSectionId, string>>;
};

const INSUFFICIENT_STRATEGY = "Insufficient evidence — confirm Campaign Intelligence.";

const DIMENSION_FIX_TARGET: Record<StudioPackageCheckId, StudioWorkspaceStepId> = {
  intake: "intake",
  strategy: "strategy",
  discovery: "creators",
  creators: "creators",
  content: "content",
  commercial: "commercial",
  timeline: "package",
  proposal: "package",
  presentation: "package",
};

function asOptions(
  input?: ReadonlySet<CampaignStudioSectionId> | StudioPackageReadinessOptions
): StudioPackageReadinessOptions {
  if (!input) return {};
  if (input instanceof Set) {
    return { outdatedSections: input };
  }
  if (
    typeof (input as { has?: unknown }).has === "function" &&
    !("outdatedSections" in input) &&
    !("sectionStatuses" in input)
  ) {
    return { outdatedSections: input as ReadonlySet<CampaignStudioSectionId> };
  }
  return input as StudioPackageReadinessOptions;
}

function outputLiveStatus(campaignObject: CampaignObject, kind: CampaignOutputKind) {
  return getCampaignOutput(campaignObject, kind)?.status;
}

function stringifyOutput(content: CampaignOutputContent | undefined): string {
  if (!content) return "";
  const parts = [
    content.title,
    content.summary,
    ...(content.sections ?? []).flatMap((section) => [
      section.heading,
      section.body,
      ...(section.items ?? []),
    ]),
  ];
  return parts.filter(Boolean).join("\n");
}

function outputText(campaignObject: CampaignObject, kind: CampaignOutputKind): string {
  return stringifyOutput(getCampaignOutput(campaignObject, kind)?.content);
}

function outputDurationWeeks(
  campaignObject: CampaignObject,
  kind: CampaignOutputKind
): number | undefined {
  const record = getCampaignOutput(campaignObject, kind);
  const data = record?.content?.data as { durationWeeks?: unknown } | undefined;
  if (typeof data?.durationWeeks === "number" && Number.isFinite(data.durationWeeks)) {
    return Math.round(data.durationWeeks);
  }
  const text = stringifyOutput(record?.content);
  const total = text.match(/Total duration:\s*(\d+)\s*weeks/i);
  if (total?.[1]) return Number(total[1]);
  const flight = text.match(/\b(\d+)-week\b/i);
  if (flight?.[1]) return Number(flight[1]);
  return undefined;
}

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function includesNormalized(haystack: string, needle: string | undefined): boolean {
  const value = normalizeName(needle);
  if (!value) return true;
  return haystack.toLowerCase().includes(value);
}

function readCreatorsData(campaignObject: CampaignObject): CreatorsSectionData {
  return (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
}

function currentCreatorIds(campaignObject: CampaignObject): string[] {
  const fromSlate = resolveSlate(campaignObject).map((creator) => creator.creatorId);
  if (fromSlate.length > 0) return fromSlate;
  return readCreatorsData(campaignObject).recommendations?.creatorIds ?? [];
}

function presentationStatus(
  campaignObject: CampaignObject
): PresentationStatusSectionData["status"] | undefined {
  const data = campaignObject.sections.presentation.data as
    | PresentationStatusSectionData
    | undefined;
  return data?.status;
}

function isDimensionPassing(state: StudioPackageDimensionState): boolean {
  return state === "ready" || state === "current";
}

function check(
  id: StudioPackageCheckId,
  label: string,
  state: StudioPackageDimensionState,
  reason?: string,
  action?: string
): StudioPackageCheck {
  const passing = isDimensionPassing(state);
  return {
    id,
    label,
    state,
    ready: passing,
    reason,
    action,
    fixTarget: DIMENSION_FIX_TARGET[id],
    attention: passing ? undefined : reason,
  };
}

function evaluateIntake(campaignObject: CampaignObject): StudioPackageCheck {
  const facts = getCampaignFacts(campaignObject);
  const intake = requiredIntakeFacts(facts);
  const blocking = intake.rows.filter(
    (row) =>
      row.required &&
      row.state === "missing" &&
      row.key !== "budget"
  );
  if (blocking.length > 0) {
    return check(
      "intake",
      "Campaign Intelligence",
      "blocked",
      `Missing: ${blocking.map((row) => row.label).join(", ")}.`,
      "Confirm the missing campaign facts on Intake."
    );
  }
  if (!isStudioIntakeConfirmed(campaignObject) || !facts) {
    return check(
      "intake",
      "Campaign Intelligence",
      "blocked",
      "Campaign Intelligence is not confirmed.",
      "Confirm campaign facts on Intake."
    );
  }
  return check("intake", "Campaign Intelligence", "current");
}

function evaluateStrategy(
  campaignObject: CampaignObject,
  outdated: ReadonlySet<CampaignStudioSectionId>,
  running: boolean
): StudioPackageCheck {
  if (running) {
    return check("strategy", "Strategy", "in_progress", "Strategy is still being built.");
  }
  if (outdated.has("executive-strategy") || outputLiveStatus(campaignObject, "full_strategy") === "needs_update") {
    return check(
      "strategy",
      "Strategy",
      "outdated",
      "Strategy was generated before the latest campaign facts.",
      "Regenerate Strategy from confirmed Campaign Facts."
    );
  }
  const status = outputLiveStatus(campaignObject, "full_strategy");
  if (status !== "generated") {
    return check(
      "strategy",
      "Strategy",
      "blocked",
      "Influencer strategy has not been generated from current facts.",
      "Generate Strategy after confirming Campaign Intelligence."
    );
  }
  const view = deriveInfluencerStrategyView(campaignObject);
  const required = ["influencerStrategy", "platformStrategy", "contentStrategy"] as const;
  const missing = required.filter((key) => {
    const body = view.find((item) => item.key === key)?.body ?? "";
    return !body.trim() || body === INSUFFICIENT_STRATEGY || /insufficient evidence/i.test(body);
  });
  if (missing.length > 0) {
    return check(
      "strategy",
      "Strategy",
      "blocked",
      "Strategy text exists, but the influencer approach is not evidence-backed.",
      "Confirm Campaign Intelligence, then regenerate Strategy."
    );
  }
  return check("strategy", "Strategy", "ready");
}

function evaluateDiscovery(
  campaignObject: CampaignObject,
  outdated: ReadonlySet<CampaignStudioSectionId>,
  running: boolean
): StudioPackageCheck {
  const sufficiency = resolveStudioDiscoverySufficiency(campaignObject, running);
  if (sufficiency.state === "acquisition_running") {
    return check(
      "discovery",
      "Discovery",
      "in_progress",
      sufficiency.detail,
      sufficiency.nextAction
    );
  }
  if (outdated.has("creator-discovery")) {
    return check(
      "discovery",
      "Discovery",
      "outdated",
      "Discovery results were produced before the latest campaign facts.",
      "Re-run Discovery against the current confirmed profile."
    );
  }
  if (sufficiency.state === "discovery_sufficient") {
    return check("discovery", "Discovery", "ready");
  }
  if (sufficiency.state === "discovery_ready") {
    return check(
      "discovery",
      "Discovery",
      "blocked",
      sufficiency.detail,
      sufficiency.nextAction
    );
  }
  return check(
    "discovery",
    "Discovery",
    "blocked",
    sufficiency.detail,
    sufficiency.nextAction
  );
}

function evaluateCreators(
  campaignObject: CampaignObject,
  outdated: ReadonlySet<CampaignStudioSectionId>,
  facts: CampaignFacts | undefined
): StudioPackageCheck {
  const quantity = deriveCreatorQuantityRecommendation(facts);
  if (!facts?.budget || !(facts.budget.amount > 0) || !facts.budget.currency?.trim()) {
    return check(
      "creators",
      "Creators",
      "blocked",
      "Creator quantity cannot be finalized because campaign budget is not confirmed.",
      "Confirm campaign budget on Intake, then re-evaluate quantity."
    );
  }
  const staleInputs = describeStaleReason(campaignObject, "full_strategy")?.staleInputs ?? [];
  const factsShifted = staleInputs.some((key) =>
    key === "budget" || key === "timeline" || key === "objective" || key === "audience" || key === "market"
  );
  if (
    factsShifted &&
    (outdated.has("creator-recommendations") || outdated.has("creator-mix"))
  ) {
    return check(
      "creators",
      "Creators",
      "outdated",
      "Creator recommendations were produced before the latest campaign facts or slate change.",
      "Review the creator slate against the current strategy."
    );
  }
  if (quantity.recommended == null) {
    return check(
      "creators",
      "Creators",
      "blocked",
      quantity.rationale,
      "Confirm budget, duration, and objective, then re-evaluate quantity."
    );
  }
  const ids = currentCreatorIds(campaignObject);
  if (ids.length === 0) {
    return check(
      "creators",
      "Creators",
      "blocked",
      "No creator slate is in place.",
      "Complete Discovery and lock a recommended slate."
    );
  }
  const reasoning = readCreatorsData(campaignObject).recommendations?.selectedReasoning ?? [];
  const evidenced = reasoning.filter(
    (entry) => entry.creatorId && (entry.whySelected?.trim() || entry.evidence?.trim())
  );
  if (evidenced.length === 0) {
    return check(
      "creators",
      "Creators",
      "blocked",
      "Creator recommendations exist without evidence for why they were selected.",
      "Regenerate recommendations from current Strategy and Campaign Facts."
    );
  }
  return check("creators", "Creators", "ready");
}

function evaluateContent(
  campaignObject: CampaignObject,
  outdated: ReadonlySet<CampaignStudioSectionId>
): StudioPackageCheck {
  if (outdated.has("content-plan") || outputLiveStatus(campaignObject, "content_calendar") === "needs_update") {
    return check(
      "content",
      "Content",
      "outdated",
      "Content was generated against a previous strategy or creator slate.",
      "Regenerate the per-creator content plan."
    );
  }
  const plan = deriveInfluencerContentPlan(campaignObject);
  if (plan.length === 0) {
    return check(
      "content",
      "Content",
      "blocked",
      "Per-creator influencer content does not exist. A generic platform/tier table is not enough.",
      "Generate content after Strategy and creators are current."
    );
  }
  const slateIds = new Set(currentCreatorIds(campaignObject));
  const planIds = new Set(plan.map((item) => item.creatorId).filter(Boolean) as string[]);
  const staleCreators = [...planIds].some((id) => !slateIds.has(id));
  const missingCreators = [...slateIds].some((id) => !planIds.has(id));
  if (staleCreators || missingCreators) {
    return check(
      "content",
      "Content",
      "outdated",
      "Content still refers to a previous creator slate.",
      "Regenerate content for the current recommended creators."
    );
  }
  const incomplete = plan.filter(
    (item) =>
      !item.creatorId ||
      !item.strategyTrace?.trim() ||
      !item.hook?.trim() ||
      !item.keyMessage?.trim() ||
      !item.cta?.trim()
  );
  if (incomplete.length > 0) {
    return check(
      "content",
      "Content",
      "blocked",
      "Influencer content is missing hook, message, CTA, or Strategy trace.",
      "Regenerate the per-creator content plan from Strategy."
    );
  }
  return check("content", "Content", "ready");
}

function evaluateCommercial(
  campaignObject: CampaignObject,
  outdated: ReadonlySet<CampaignStudioSectionId>,
  facts: CampaignFacts | undefined
): StudioPackageCheck {
  const budget = facts?.budget;
  if (!budget || !(budget.amount > 0) || !budget.currency?.trim()) {
    return check(
      "commercial",
      "Commercial",
      "blocked",
      "Budget is required to finalize Commercial.",
      "Confirm campaign budget on Intake. Do not invent a value."
    );
  }
  if (outdated.has("budget-planner") || outputLiveStatus(campaignObject, "budget_allocation") === "needs_update") {
    return check(
      "commercial",
      "Commercial",
      "outdated",
      "Commercial values changed after creator selection, budget, or quantity updates.",
      "Recalculate the commercial plan from the current slate."
    );
  }
  const commercial = resolveBudgetData(campaignObject);
  if (!commercial || commercial.allocations.length === 0) {
    return check(
      "commercial",
      "Commercial",
      "blocked",
      "Commercial totals are not available from the current slate.",
      "Rebuild commercial values from confirmed facts and creators."
    );
  }
  if (
    commercial.total != null &&
    Math.abs((commercial.total ?? 0) - budget.amount) > 1
  ) {
    return check(
      "commercial",
      "Commercial",
      "blocked",
      "Commercial totals do not match the confirmed campaign budget.",
      "Recalculate commercial from Campaign Facts."
    );
  }
  if (commercial.currency && commercial.currency !== budget.currency) {
    return check(
      "commercial",
      "Commercial",
      "blocked",
      "Commercial currency does not match Campaign Facts.",
      "Recalculate commercial in the confirmed currency."
    );
  }
  return check("commercial", "Commercial", "ready");
}

function evaluateTimeline(
  campaignObject: CampaignObject,
  outdated: ReadonlySet<CampaignStudioSectionId>,
  facts: CampaignFacts | undefined
): StudioPackageCheck {
  if (facts?.durationWeeks == null) {
    return check(
      "timeline",
      "Timeline",
      "blocked",
      "Campaign duration is not confirmed. Timeline cannot be invented.",
      "Confirm duration on Intake."
    );
  }
  if (outdated.has("timeline")) {
    return check(
      "timeline",
      "Timeline",
      "outdated",
      `Timeline still reflects a previous duration. Campaign Facts are ${facts.durationWeeks} weeks.`,
      "Regenerate Timeline from confirmed Campaign Facts."
    );
  }
  const storedActivation = (
    campaignObject.sections.timeline.data as
      | { creatorActivationTimeline?: { durationWeeks?: number } }
      | undefined
  )?.creatorActivationTimeline?.durationWeeks;
  if (
    storedActivation != null &&
    storedActivation !== facts.durationWeeks
  ) {
    return check(
      "timeline",
      "Timeline",
      "outdated",
      `Facts = ${facts.durationWeeks} weeks. Stored timeline = ${storedActivation} weeks.`,
      "Regenerate Timeline so it matches confirmed duration."
    );
  }
  const calendarWeeks = outputDurationWeeks(campaignObject, "content_calendar");
  if (calendarWeeks != null && calendarWeeks !== facts.durationWeeks) {
    return check(
      "timeline",
      "Timeline",
      "outdated",
      `Facts = ${facts.durationWeeks} weeks. Content calendar = ${calendarWeeks} weeks.`,
      "Regenerate affected timeline outputs."
    );
  }
  const timeline = resolveTimelineData(campaignObject);
  if (timeline && timeline.durationWeeks !== facts.durationWeeks) {
    return check(
      "timeline",
      "Timeline",
      "outdated",
      `Facts = ${facts.durationWeeks} weeks. Timeline = ${timeline.durationWeeks} weeks.`,
      "Regenerate Timeline from Campaign Facts."
    );
  }
  return check("timeline", "Timeline", "ready");
}

function evaluateGeneratedClientOutput(
  campaignObject: CampaignObject,
  id: "proposal" | "presentation",
  kind: CampaignOutputKind,
  fallbackKind: CampaignOutputKind | null,
  outdatedFlag: boolean,
  label: string
): StudioPackageCheck {
  const live = outputLiveStatus(campaignObject, kind);
  const fallback = fallbackKind ? outputLiveStatus(campaignObject, fallbackKind) : undefined;
  const status = live ?? fallback;
  if (outdatedFlag || status === "needs_update") {
    return check(
      id,
      label,
      "outdated",
      `${label} was generated before the latest campaign changes.`,
      `Regenerate ${label} from current Campaign Facts.`
    );
  }
  if (status !== "generated") {
    return check(
      id,
      label,
      "blocked",
      `${label} is not current. A successful PDF/PPTX export is not readiness.`,
      `Generate ${label} after Strategy, Creators, Content, Commercial, and Timeline are current.`
    );
  }
  return check(id, label, "ready");
}

function collectConsistencyIssues(
  campaignObject: CampaignObject,
  facts: CampaignFacts | undefined,
  checks: StudioPackageCheck[]
): StudioPackageConsistencyIssue[] {
  const issues: StudioPackageConsistencyIssue[] = [];
  const proposalReady = checks.find((item) => item.id === "proposal")?.state === "ready";
  const presentationReady = checks.find((item) => item.id === "presentation")?.state === "ready";
  if (!facts || (!proposalReady && !presentationReady)) return issues;

  const proposalText = outputText(campaignObject, "executive_proposal");
  const strategyText = outputText(campaignObject, "full_strategy");
  const haystack = `${proposalText}\n${strategyText}`;
  const client = facts.clientName ?? facts.brandName;
  const campaign = facts.product;
  const country = facts.geography?.[0];
  const creatorIds = currentCreatorIds(campaignObject);
  const slate = resolveSlate(campaignObject);

  const clientOk =
    includesNormalized(haystack, facts.clientName) || includesNormalized(haystack, facts.brandName);
  if (client && haystack && !clientOk) {
    issues.push({
      key: "client",
      label: "Client",
      reason: `Package still does not show ${client}.`,
      fixTarget: "package",
    });
  }
  if (campaign && haystack && includesNormalized(haystack, campaign) === false) {
    const mentionsCampaignHeading = /campaign name|product:/i.test(haystack);
    if (mentionsCampaignHeading) {
      issues.push({
        key: "campaign",
        label: "Campaign",
        reason: `Package campaign name does not match ${campaign}.`,
        fixTarget: "package",
      });
    }
  }
  if (country && haystack && includesNormalized(haystack, country)) {
    // Represented and matching — no issue.
  } else if (country && haystack && /\b(uae|saudi|jordan|kuwait|qatar|bahrain|oman)\b/i.test(haystack)) {
    issues.push({
      key: "market",
      label: "Country / market",
      reason: `Confirmed market ${country} conflicts with generated package outputs.`,
      fixTarget: "package",
    });
  }
  const objectiveToken = facts.objective?.split(/[+/,]/)[0]?.trim();
  if (objectiveToken && haystack && !includesNormalized(haystack, objectiveToken)) {
    issues.push({
      key: "objective",
      label: "Objective",
      reason: "Package still references a previous campaign objective.",
      fixTarget: "strategy",
    });
  }
  if (facts.durationWeeks != null) {
    for (const kind of ["full_strategy", "executive_proposal", "content_calendar"] as const) {
      if (outputLiveStatus(campaignObject, kind) !== "generated") continue;
      const weeks = outputDurationWeeks(campaignObject, kind);
      if (weeks != null && weeks !== facts.durationWeeks) {
        issues.push({
          key: "duration",
          label: "Duration",
          reason: `Campaign Facts are ${facts.durationWeeks} weeks. ${kind.replaceAll("_", " ")} still shows ${weeks} weeks.`,
          fixTarget: "package",
        });
      }
    }
  }
  if (facts.budget) {
    const formatted = formatMoneyKpi(facts.budget.amount, facts.budget.currency);
    const amount = Math.round(facts.budget.amount).toLocaleString("en-US");
    if (
      proposalReady &&
      proposalText &&
      !proposalText.includes(formatted) &&
      !proposalText.includes(amount) &&
      !proposalText.includes(String(Math.round(facts.budget.amount)))
    ) {
      issues.push({
        key: "budget",
        label: "Budget",
        reason: `Proposal does not show the confirmed budget of ${formatted}.`,
        fixTarget: "commercial",
      });
    }
    if (proposalReady && facts.budget.currency && !includesNormalized(proposalText, facts.budget.currency)) {
      issues.push({
        key: "currency",
        label: "Currency",
        reason: "Package currency does not match Commercial.",
        fixTarget: "commercial",
      });
    }
  }
  if (proposalReady && creatorIds.length > 0) {
    const mentioned = slate.filter((creator) =>
      includesNormalized(proposalText, creator.displayName)
    );
    if (mentioned.length === 0 && proposalText.toLowerCase().includes("creator")) {
      issues.push({
        key: "creator_selection",
        label: "Creator selection",
        reason: "Proposal does not reflect the current Studio slate.",
        fixTarget: "creators",
      });
    }
  }

  return issues;
}

function deriveOverall(
  checks: StudioPackageCheck[],
  consistencyIssues: StudioPackageConsistencyIssue[],
  campaignObject: CampaignObject
): StudioPackageOverallState {
  if (checks.some((item) => item.state === "blocked")) return "blocked";
  if (checks.some((item) => item.state === "in_progress")) return "in_progress";
  if (checks.some((item) => item.state === "outdated") || consistencyIssues.length > 0) {
    return "outdated";
  }
  const presentation = presentationStatus(campaignObject);
  if (presentation === "awaiting_approval") return "ready_for_internal_review";
  return "ready_for_client";
}

function headlineFor(overall: StudioPackageOverallState): string {
  return STUDIO_PACKAGE_OVERALL_LABEL[overall];
}

function attentionSummaryFor(
  overall: StudioPackageOverallState,
  attentionCount: number
): string | undefined {
  if (overall === "ready_for_client" || overall === "ready_for_internal_review") return undefined;
  if (attentionCount === 0) return undefined;
  return attentionCount === 1 ? "1 item needs attention" : `${attentionCount} items need attention`;
}

function buildSourceState(campaignObject: CampaignObject): StudioPackageSourceState {
  const facts = getCampaignFacts(campaignObject);
  const outputVersions: StudioPackageSourceState["outputVersions"] = {};
  for (const view of listCampaignOutputs(campaignObject)) {
    if (view.version > 0) {
      outputVersions[view.kind] = { version: view.version, status: view.status };
    }
  }
  return {
    campaignObjectId: campaignObject.id,
    updatedAt: campaignObject.updatedAt,
    factsExtractedAt: facts?.extractedAt,
    factsConfirmedAt: campaignObject.meta.factsConfirmedAt,
    durationWeeks: facts?.durationWeeks,
    budgetAmount: facts?.budget?.amount,
    budgetCurrency: facts?.budget?.currency,
    creatorIds: currentCreatorIds(campaignObject),
    outputVersions,
  };
}

function emptyReadiness(headline: string): StudioPackageReadiness {
  return {
    overall: "blocked",
    headline,
    attentionSummary: undefined,
    checks: [],
    attentionCount: 0,
    readyForClient: false,
    canCreateClientReview: false,
    clientReviewBlockers: [headline],
    consistencyIssues: [],
    sourceState: { creatorIds: [], outputVersions: {} },
    diagnostics: {
      sourceFingerprints: {},
      quantityRecommended: null,
      staleOutputKinds: [],
    },
  };
}

/**
 * Package-level readiness and consistency gate.
 * Derives from Campaign Facts, Wave 1 fingerprints, Discovery sufficiency,
 * quantity, content, commercial, and the output registry — not a second SSOT.
 */
export function resolveStudioPackageReadiness(
  campaignObject: CampaignObject | undefined,
  outdatedOrOptions?: ReadonlySet<CampaignStudioSectionId> | StudioPackageReadinessOptions
): StudioPackageReadiness {
  if (!campaignObject) {
    return emptyReadiness("Campaign package is not ready yet.");
  }

  const options = asOptions(outdatedOrOptions);
  const outdated = options.outdatedSections ?? new Set<CampaignStudioSectionId>();
  const facts = getCampaignFacts(campaignObject);
  const discoveryRunning =
    options.sectionStatuses?.["creator-discovery"] === "running" ||
    readCreatorsData(campaignObject).phase === "discovery";
  const strategyRunning = options.sectionStatuses?.["executive-strategy"] === "running";

  const checks: StudioPackageCheck[] = [
    evaluateIntake(campaignObject),
    evaluateStrategy(campaignObject, outdated, strategyRunning),
    evaluateDiscovery(campaignObject, outdated, discoveryRunning),
    evaluateCreators(campaignObject, outdated, facts),
    evaluateContent(campaignObject, outdated),
    evaluateCommercial(campaignObject, outdated, facts),
    evaluateTimeline(campaignObject, outdated, facts),
    evaluateGeneratedClientOutput(
      campaignObject,
      "proposal",
      "executive_proposal",
      null,
      outdated.has("executive-summary"),
      "Proposal"
    ),
    evaluateGeneratedClientOutput(
      campaignObject,
      "presentation",
      "client_presentation",
      "executive_proposal",
      outdated.has("presentation-status"),
      "Presentation"
    ),
  ];

  const consistencyIssues = collectConsistencyIssues(campaignObject, facts, checks);
  if (consistencyIssues.length > 0) {
    for (const issue of consistencyIssues) {
      const target = checks.find((item) => DIMENSION_FIX_TARGET[item.id] === issue.fixTarget);
      const dim =
        issue.key === "duration"
          ? checks.find((item) => item.id === "timeline")
          : issue.key === "budget" || issue.key === "currency"
            ? checks.find((item) => item.id === "commercial")
            : issue.key === "objective"
              ? checks.find((item) => item.id === "strategy")
              : issue.key === "creator_selection"
                ? checks.find((item) => item.id === "proposal")
                : target ?? checks.find((item) => item.id === "proposal");
      if (dim && isDimensionPassing(dim.state)) {
        dim.state = "outdated";
        dim.ready = false;
        dim.reason = issue.reason;
        dim.action = "Regenerate affected outputs so the package matches Campaign Facts.";
        dim.attention = issue.reason;
      }
    }
  }

  const attention = checks.filter((item) => !isDimensionPassing(item.state));
  const overall = deriveOverall(checks, consistencyIssues, campaignObject);
  const readyForClient = overall === "ready_for_client";
  const clientReviewBlockers = readyForClient
    ? []
    : attention
        .slice(0, 6)
        .map((item) => item.reason ?? `${item.label} is ${item.state.replaceAll("_", " ")}.`);

  const fingerprints: StudioPackageDiagnostics["sourceFingerprints"] = {};
  for (const kind of ["full_strategy", "executive_proposal", "content_calendar", "media_plan"] as const) {
    const fingerprint = getCampaignOutput(campaignObject, kind)?.sourceFingerprint;
    if (fingerprint) fingerprints[kind] = fingerprint;
  }

  return {
    overall,
    headline: headlineFor(overall),
    attentionSummary: attentionSummaryFor(overall, attention.length),
    checks,
    attentionCount: attention.length,
    readyForClient,
    canCreateClientReview: readyForClient,
    clientReviewBlockers,
    consistencyIssues,
    sourceState: buildSourceState(campaignObject),
    diagnostics: {
      sourceFingerprints: fingerprints,
      discoveryState: resolveStudioDiscoverySufficiency(campaignObject, discoveryRunning).state,
      quantityRecommended: deriveCreatorQuantityRecommendation(facts).recommended,
      staleOutputKinds: listCampaignOutputs(campaignObject)
        .filter((view) => view.status === "needs_update")
        .map((view) => view.kind),
    },
  };
}

export function canCreateClientReview(readiness: StudioPackageReadiness): boolean {
  return readiness.canCreateClientReview && readiness.overall === "ready_for_client";
}

export function firstPackageFixTarget(
  readiness: StudioPackageReadiness
): StudioWorkspaceStepId {
  const commercial = readiness.checks.find((item) => item.id === "commercial" && !item.ready);
  if (commercial && /budget/i.test(`${commercial.reason ?? ""} ${commercial.action ?? ""}`)) {
    return "intake";
  }
  return readiness.checks.find((item) => !item.ready)?.fixTarget ?? "package";
}
