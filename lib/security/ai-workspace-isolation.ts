/**
 * P4 AI isolation: Discovery AI must not retrieve Finance / Operations /
 * Billing internals or cross-tenant data. Tools run under the caller's JWT
 * (RLS); this module adds an explicit deny-list for finance-shaped surfaces.
 */

/** Tool names that must never be registered for client/portal execution paths. */
export const AI_INTERNAL_ONLY_TOOLS = [
  "searchCreators",
  "getCreator",
  "getCampaign",
  "getClient",
  "getShortlist",
  "createShortlist",
  "buildCampaign",
  "generateBrief",
  "generateReport",
] as const;

/** Report types that imply finance / billing retrieval — denied. */
export const AI_DENIED_REPORT_TYPES = ["billing"] as const;

/** Substrings that must not appear in tool names for future finance tools. */
export const AI_FORBIDDEN_TOOL_NAME_PATTERNS = [
  /finance/i,
  /invoice/i,
  /billing/i,
  /treasury/i,
  /posting/i,
  /exchange.?rate/i,
  /credit.?note/i,
  /debit.?note/i,
  /vat/i,
  /po.?tracker/i,
  /collections/i,
] as const;

export function isAiToolNameForbidden(toolName: string): boolean {
  return AI_FORBIDDEN_TOOL_NAME_PATTERNS.some((pattern) => pattern.test(toolName));
}

export function assertAiReportTypeAllowed(reportType: string): void {
  if (
    (AI_DENIED_REPORT_TYPES as readonly string[]).includes(
      reportType.toLowerCase(),
    )
  ) {
    throw new Error(
      "AI tools cannot generate billing or finance reports. Use the Finance workspace.",
    );
  }
}

export function assertAiToolAllowedForWorkspace(toolName: string): void {
  if (isAiToolNameForbidden(toolName)) {
    throw new Error(
      `AI tool "${toolName}" is blocked — finance/operations tools are not available to Discovery AI.`,
    );
  }
}
