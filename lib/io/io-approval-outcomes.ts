export type IoApprovalOutcomeCode =
  | "approved"
  | "already_approved"
  | "expired"
  | "superseded"
  | "invalid";

/** Outcomes returned when approval cannot proceed (or must stop with an error page). */
export type IoApprovalFailureCode = Exclude<
  IoApprovalOutcomeCode,
  "approved" | "already_approved"
>;

export type IoApprovalOutcomeView = {
  code: IoApprovalOutcomeCode;
  title: string;
  body: string;
  tone: "success" | "info" | "warning" | "danger";
};

const OUTCOMES: Record<IoApprovalOutcomeCode, Omit<IoApprovalOutcomeView, "code">> = {
  approved: {
    title: "Approved",
    body: "Thank you. Your approval has been recorded successfully.",
    tone: "success",
  },
  already_approved: {
    title: "Already Approved",
    body: "This document has already been approved. Thank you. No further action is required.",
    tone: "info",
  },
  expired: {
    title: "Expired",
    body: "This approval link has expired. Please contact Thinkway Media if a new approval request is required.",
    tone: "warning",
  },
  superseded: {
    title: "Superseded",
    body: "A newer version of this document has been issued. Please use the latest approval request that was sent to you.",
    tone: "warning",
  },
  invalid: {
    title: "Link Unavailable",
    body: "This approval link is no longer valid. Please contact Thinkway Media if you need assistance.",
    tone: "danger",
  },
};

export function getIoApprovalOutcomeView(
  code: IoApprovalOutcomeCode
): IoApprovalOutcomeView {
  return { code, ...OUTCOMES[code] };
}

/**
 * Map Postgres exception text / ERRCODE-style markers to failure UX codes.
 * Already-approved is returned as a successful RPC payload (`already_approved: true`),
 * not as an exception — so it is not part of this mapper.
 */
export function mapApprovalRpcErrorToOutcome(
  message: string | null | undefined
): IoApprovalFailureCode {
  const normalized = (message ?? "").toUpperCase();
  if (normalized.includes("APPROVAL_EXPIRED")) return "expired";
  if (normalized.includes("APPROVAL_SUPERSEDED")) return "superseded";
  if (normalized.includes("APPROVAL_INVALID")) return "invalid";
  return "invalid";
}
