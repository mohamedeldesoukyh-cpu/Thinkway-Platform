/**
 * The ONE campaign decision per creator.
 *
 * Enterprise Creator Intelligence is an investment/commercial intelligence
 * layer. Its verdict was being mapped straight into a campaign decision:
 * `toCampaignDecisionLabel(signal.recommendation)` fed the recommendation gate,
 * the card's pill, the executive planning view and the candidate label
 * "Campaign recommendation: not recommended". So an investment reading became
 * the campaign's answer, and a card could sit inside the campaign
 * recommendation area saying it was not recommended for that campaign.
 *
 * The two are not the same question:
 *   - ECI asks whether this creator is a sound investment;
 *   - the campaign asks whether this creator fits THIS strategy.
 * A creator can be a strong investment and a poor fit, or a thin investment
 * record and an acceptable fit. And missing intelligence is missing — never a
 * rejection.
 *
 * So the decision here is built only from campaign inputs that already exist:
 * the campaign's market, the brief's creator mix, the Strategy-derived
 * requirement coverage (`studioCreatorRequirementScore`), slate membership, and
 * the operator's own decision (`vendorDecisions`). ECI rides along as
 * SUPPORTING intelligence and cannot change the status.
 *
 * No ECI calculation is touched. Nothing is persisted: this is a projection of
 * state the campaign object already holds.
 */

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import type { StudioEciPlanningSignal } from "./eci/project-studio-eci-signal";
import { containsInternalTerminology } from "./studio-creator-client-decision";
import type { CampaignCreatorStatus } from "./creator-decision-status";
import { vendorMatchesCampaignMarket, type StudioCreatorLocation } from "./studio-market-creators";
import { vendorFitsStudioBriefMix } from "./studio-creator-requirements";

export type CampaignCreatorDecisionStatus =
  | "recommended"
  | "not_recommended"
  /** Neutral. The campaign cannot yet judge this creator — not a rejection. */
  | "needs_review";

export type CampaignCreatorDecision = {
  status: CampaignCreatorDecisionStatus;
  /** The single label. Heading, pill and detail all read this. */
  label: string;
  /** One client-safe sentence answering "why this status". */
  why: string;
  /** Client-safe proof for that status. */
  evidence: string[];
  /**
   * Supporting intelligence — shown as support, never as the decision. Lines
   * carrying internal terminology are dropped here, not rewritten.
   */
  supporting: string[];
};

export const CAMPAIGN_CREATOR_DECISION_LABEL: Record<
  CampaignCreatorDecisionStatus,
  string
> = {
  recommended: "Recommended for this campaign",
  not_recommended: "Not recommended for this campaign",
  needs_review: "Needs review",
};

/** A campaign requirement that was actually stated, and whether this creator meets it. */
export type CampaignRequirementCheck = {
  label: string;
  /** `null` when the campaign did not state this requirement. */
  met: boolean | null;
};

function clientSafe(lines: Array<string | null | undefined>, limit: number): string[] {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const trimmed = line?.replace(/\s+/g, " ").trim();
    if (!trimmed || trimmed.length < 8 || trimmed.length > 140) continue;
    if (containsInternalTerminology(trimmed)) continue;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed.endsWith(".") ? trimmed : `${trimmed}.`);
    if (kept.length >= limit) break;
  }
  return kept;
}

/**
 * ECI as support only.
 *
 * Its strengths and objective-support lines are already human sentences; the
 * analyst vocabulary ("mixed investment signals", "commercial outlook weak",
 * "overall score 40 with multiple high risks") is dropped rather than
 * paraphrased, because paraphrasing an internal reading is still surfacing it.
 */
function supportingLines(signal: StudioEciPlanningSignal | null | undefined): string[] {
  if (!signal) return [];
  return clientSafe([...(signal.topStrengths ?? []), signal.businessObjectiveSupport], 2);
}

export function resolveCampaignCreatorDecision(input: {
  /** On the campaign's composed slate. */
  onSlate: boolean;
  /** The operator's own decision, when one is recorded. */
  operatorStatus?: CampaignCreatorStatus;
  /** Requirements the campaign actually stated, in the order they should read. */
  requirements: CampaignRequirementCheck[];
  /**
   * The campaign's own reason for putting this creator on the slate, as the
   * Strategy wrote it. It leads the evidence so the card carries ONE Why and
   * one set of proof rather than a decision line beside an unrelated one.
   */
  slateRationale?: string | null;
  /** Investment intelligence — support only. */
  supportingSignal?: StudioEciPlanningSignal | null;
}): CampaignCreatorDecision {
  const supporting = supportingLines(input.supportingSignal);
  const stated = input.requirements.filter((row) => row.met != null);
  const failed = stated.filter((row) => row.met === false);
  const passed = stated.filter((row) => row.met === true);

  const decide = (
    status: CampaignCreatorDecisionStatus,
    why: string,
    evidence: Array<string | null | undefined>
  ): CampaignCreatorDecision => ({
    status,
    label: CAMPAIGN_CREATOR_DECISION_LABEL[status],
    why,
    evidence: clientSafe(
      // A rejection states the requirement that failed first; anything else
      // leads with the campaign's own reason for the creator.
      status === "not_recommended"
        ? [...evidence, input.slateRationale]
        : [input.slateRationale, ...evidence],
      3
    ),
    supporting,
  });

  // The operator's decision outranks every derivation — it is the campaign's
  // own answer, and it is what execution already honours.
  if (input.operatorStatus === "rejected") {
    return decide("not_recommended", "Removed from this campaign by the team.", [
      "The team recorded a decision to take this creator out of the campaign.",
    ]);
  }
  if (input.operatorStatus === "approved") {
    return decide("recommended", "Approved for this campaign by the team.", [
      passed.length > 0
        ? `Meets the campaign's ${passed.map((row) => row.label.toLowerCase()).join(", ")} requirement${passed.length === 1 ? "" : "s"}.`
        : null,
      "The team confirmed this creator for the campaign.",
    ]);
  }

  // Missing intelligence is missing. It never becomes a rejection.
  if (stated.length === 0) {
    return decide(
      "needs_review",
      "The campaign has not stated enough requirements to judge this creator yet.",
      [
        "Confirm the campaign's market, platforms and creator mix, then this decision resolves.",
      ]
    );
  }

  if (failed.length > 0) {
    return decide(
      "not_recommended",
      `Does not meet the campaign's ${failed.map((row) => row.label.toLowerCase()).join(" or ")} requirement${failed.length === 1 ? "" : "s"}.`,
      [
        ...failed.map((row) => `${row.label}: not met for this campaign.`),
        passed.length > 0
          ? `Meets ${passed.length} of ${stated.length} stated campaign requirements.`
          : null,
      ]
    );
  }

  const coverage = `Meets ${passed.length} of ${stated.length} stated campaign requirement${stated.length === 1 ? "" : "s"}.`;

  if (passed.length === stated.length) {
    return decide("recommended", "Meets every campaign requirement stated for this brief.", [
      coverage,
      ...passed.map((row) => `${row.label}: met.`),
    ]);
  }

  // Partial coverage with nothing failed means some requirement could not be
  // evaluated. On the slate, the campaign already judged this creator a fit
  // when it composed the slate, so that stands; off the slate it is a review.
  return input.onSlate
    ? decide("recommended", "On the campaign slate and meets the requirements that could be checked.", [
        coverage,
        "Remaining requirements could not be checked from the data available.",
      ])
    : decide("needs_review", "Not every campaign requirement could be checked for this creator.", [
        coverage,
        "Remaining requirements could not be checked from the data available.",
      ]);
}

/**
 * Guard for the invariant the screens must hold: supporting intelligence can
 * never be presented as the campaign's decision.
 */
export function campaignDecisionContradictsSupporting(
  decision: CampaignCreatorDecision
): boolean {
  const decisionText = [decision.label, decision.why, ...decision.evidence].join(" ");
  if (containsInternalTerminology(decisionText)) return true;
  return decision.supporting.some((line) => containsInternalTerminology(line));
}

/**
 * The campaign requirements this brief actually stated, named.
 *
 * The same predicates `studioCreatorRequirementScore` and the recommendation
 * gate use — reused, not re-implemented — so a card's evidence names the
 * requirement that decided it. A requirement the campaign never stated is
 * `null`, so it neither passes nor fails: an unstated market cannot reject a
 * creator.
 *
 * Platform is a campaign requirement and is checked here. It is NOT the
 * Discovery Platform Score, which stays out of selection and ordering.
 */
export function campaignRequirementChecks(
  creator: StudioCreatorLocation & {
    platform?: string;
    audienceSummary?: string;
    category?: string;
    categories?: string[];
    handle?: string;
    displayName?: string;
  },
  facts: CampaignFacts | undefined
): CampaignRequirementCheck[] {
  const markets = facts?.geography?.filter((value) => value.trim()) ?? [];
  const platforms = (facts?.platforms ?? []).map((item) => item.trim()).filter(Boolean);
  const creatorPlatform = creator.platform?.trim().toLowerCase() ?? "";

  return [
    {
      label: "Market",
      met: markets.length > 0 ? vendorMatchesCampaignMarket(creator, markets) : null,
    },
    {
      label: "Platform",
      met:
        platforms.length === 0 || !creatorPlatform
          ? null
          : platforms.some((item) => {
              const needle = item.trim().toLowerCase();
              return (
                Boolean(needle) &&
                (creatorPlatform.includes(needle) || needle.includes(creatorPlatform))
              );
            }),
    },
    {
      label: "Creator mix",
      met: facts ? vendorFitsStudioBriefMix(creator, facts) : null,
    },
  ];
}
