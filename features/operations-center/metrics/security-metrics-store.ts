/** In-process security event counters for Operations Center. */

export type SecurityMetrics = {
  failedLogins: number;
  successfulLogins: number;
  mfaFailures: number;
  oauthFailures: number;
  passwordResets: number;
  inviteFailures: number;
  permissionDenials: number;
  rateLimitEvents: number;
  blockedRequests: number;
  csrfFailures: number;
  ssrfBlocks: number;
  xssSanitizations: number;
  auditEvents: number;
};

const metrics: SecurityMetrics = {
  failedLogins: 0,
  successfulLogins: 0,
  mfaFailures: 0,
  oauthFailures: 0,
  passwordResets: 0,
  inviteFailures: 0,
  permissionDenials: 0,
  rateLimitEvents: 0,
  blockedRequests: 0,
  csrfFailures: 0,
  ssrfBlocks: 0,
  xssSanitizations: 0,
  auditEvents: 0,
};

export function getSecurityMetrics(): SecurityMetrics {
  return { ...metrics };
}

export function incrementSecurityMetric(
  key: keyof SecurityMetrics,
  by = 1,
): void {
  metrics[key] += by;
}

export function resetSecurityMetrics(): void {
  for (const key of Object.keys(metrics) as Array<keyof SecurityMetrics>) {
    metrics[key] = 0;
  }
}
