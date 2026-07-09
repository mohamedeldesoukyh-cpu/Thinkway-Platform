import type { DirectorSpecialistId } from "./pipeline";

/** Structured before/after record when a specialist revises their own output. */
export type SpecialistRevision = {
  previousRecommendation: string;
  issueFound: string;
  foundBy: DirectorSpecialistId;
  revisedRecommendation: string;
  whyChanged: string;
  round: number;
};

export type ReviewConversationAction =
  | "finding"
  | "revision"
  | "validation"
  | "approval";

/** Single turn in the internal Director ↔ specialist review conversation. */
export type ReviewConversationTurn = {
  speaker: DirectorSpecialistId | "director";
  message: string;
  action: ReviewConversationAction;
  round: number;
  timestamp: string;
};

/** Per-specialist review summary — internal metadata, not client-visible. */
export type DirectorReviewReportEntry = {
  specialist: DirectorSpecialistId;
  initialRecommendation: string;
  conflictFound: boolean;
  whoFoundIt?: DirectorSpecialistId | "director";
  revision?: SpecialistRevision;
  revisions: SpecialistRevision[];
  finalApproval: string;
  reasonForApproval: string;
  reviewRounds: number;
  conversation: ReviewConversationTurn[];
};

/** Full internal review conversation log for the Director pipeline. */
export type DirectorReviewReport = {
  generatedAt: string;
  totalReviewRounds: number;
  directorApproved: boolean;
  directorApprovalReason: string;
  entries: DirectorReviewReportEntry[];
  conversation: ReviewConversationTurn[];
};
