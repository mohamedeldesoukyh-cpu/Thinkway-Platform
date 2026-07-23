import type { SlateCreator } from "./output-inputs";
import type { DeliverableRole } from "./media-plan-deliverable-classification";
import type { CampaignMoment } from "./media-plan-moments";
import type { SchedulingRationale } from "./media-plan-creator-priority";
import type { MediaPlanPriorityWeights } from "./media-plan-priority-weights";

export type { SchedulingRationale } from "./media-plan-creator-priority";
export type { MediaPlanPriorityWeights } from "./media-plan-priority-weights";

/** Parse "2× TT Video" into quantity + base label. */
export function parseServiceTypeQuantity(serviceType: string): { quantity: number; baseLabel: string } {
  const trimmed = serviceType.trim();
  const match = trimmed.match(/^(\d+)\s*×\s*(.+)$/i);
  if (match) {
    return { quantity: Math.max(1, Number.parseInt(match[1]!, 10)), baseLabel: match[2]!.trim() };
  }
  return { quantity: 1, baseLabel: trimmed };
}

export type SchedulableDeliverable = {
  slotId: string;
  creator: SlateCreator;
  /** Single-unit service label shown on the calendar card. */
  serviceType: string;
  platform: string;
  /** 1-based index within this creator + base deliverable type. */
  deliverableIndex: number;
  deliverableTotal: number;
  /** Round index for week allocation — 0 = first post, 1 = second, etc. */
  creatorRound: number;
  tierRank: number;
  role: DeliverableRole;
  /** False for mirror/companion lines bundled onto a primary activation. */
  countsAsActivation: boolean;
  /** Mirror deliverables scheduled on the same day as this activation. */
  attachedMirrors: SchedulableDeliverable[];
  /** Story/support deliverables on the same day (Reel + Story Set). */
  attachedCompanions: SchedulableDeliverable[];
  /** Campaign journey moment assigned during scheduling. */
  campaignMoment?: CampaignMoment;
};

export type ScheduledDeliverablePlacement = {
  deliverable: SchedulableDeliverable;
  week: number;
  dayIndex: number;
  absoluteDay: number;
  /** Explainability — why this creator was ranked for this slot. */
  schedulingRationale?: SchedulingRationale;
};
