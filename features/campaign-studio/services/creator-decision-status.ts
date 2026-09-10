/**
 * A slate creator's status, and the one rule that reads it.
 *
 * `recommendations.creatorIds` is the WORKING campaign slate — what
 * `composeCreatorSlate` proposed, sized to the requested quantity. It is not an
 * approval: `approve_creator` / `reject_creator` do not change slate
 * membership (only `remove_creator` does), they write `vendorDecisions`. So
 * membership and status are two layers, and every consumer of the slate has to
 * read both.
 *
 * `filterExecutionCreatorIds` already did — the commercial execution mapper
 * excludes explicit rejections. Content did not: `deriveInfluencerContentPlan`
 * planned deliverables for every slate row, and `projectClientContent` put
 * them in front of the client. A creator the operator rejected therefore
 * appeared to the client as a campaign content creator. That is the gap this
 * rule closes, in one place, for both consumers.
 *
 * The ECI recommendation gate is deliberately NOT part of this. Its input
 * (`planningSignal.recommendation`) is hydrated per browser session and never
 * persisted on the campaign object, so making it decide membership would make
 * the campaign's creator set depend on hydration timing. It stays what it is:
 * session-local evidence, shown on the card and in the detail.
 */

export type CampaignCreatorDecision = "approved" | "rejected" | "shortlisted";

/**
 * A slate creator's status as any consumer should state it.
 *
 * `proposed` is the honest default: on the working slate, no operator decision
 * recorded yet.
 */
export type CampaignCreatorStatus = "approved" | "rejected" | "shortlisted" | "proposed";

/** Strips the `inf:` prefix the draft system uses, matching the decision keys. */
function decisionKey(id: string): string {
  return id.trim().replace(/^inf:/, "");
}

export function creatorDecisionStatus(
  decisions: Record<string, CampaignCreatorDecision> | undefined,
  creatorId: string
): CampaignCreatorStatus {
  if (!decisions) return "proposed";
  return decisions[creatorId] ?? decisions[decisionKey(creatorId)] ?? "proposed";
}

/** The operator took this creator out of the campaign's plan. */
export function isCreatorRejected(
  decisions: Record<string, CampaignCreatorDecision> | undefined,
  creatorId: string
): boolean {
  return creatorDecisionStatus(decisions, creatorId) === "rejected";
}

/**
 * The slate, minus explicit rejections — the creators the campaign is actually
 * planning for. Order is preserved; nothing is added.
 */
export function activeCampaignCreatorIds(
  creatorIds: string[],
  decisions: Record<string, CampaignCreatorDecision> | undefined
): string[] {
  if (!decisions || Object.keys(decisions).length === 0) return creatorIds;
  return creatorIds.filter((id) => !isCreatorRejected(decisions, id));
}

/**
 * How a status reads to an operator or a client. `rejected` has a label for
 * completeness only — a rejected creator is excluded from the plan, not
 * labelled inside it.
 */
export const CAMPAIGN_CREATOR_STATUS_LABEL: Record<CampaignCreatorStatus, string> = {
  approved: "Approved",
  shortlisted: "Shortlisted",
  proposed: "Proposed",
  rejected: "Rejected",
};

/**
 * What the Content plan is showing, said out loud.
 *
 * Content reads the working campaign slate, not an approved creator set. It
 * looked like a list of ten recommended creators because nothing on the screen
 * said otherwise.
 */
export function campaignContentBasisLine(input: {
  creatorCount: number;
  /** Slate rows excluded because the operator rejected them. */
  rejectedCount: number;
}): string {
  const creators = `${input.creatorCount} creator${input.creatorCount === 1 ? "" : "s"}`;
  const base = `Working campaign slate · ${creators} · status shown per creator`;
  if (input.rejectedCount <= 0) return `${base}.`;
  return `${base} · ${input.rejectedCount} rejected creator${
    input.rejectedCount === 1 ? "" : "s"
  } excluded.`;
}
