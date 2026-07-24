import type { SupabaseClient } from "@supabase/supabase-js";

import { getSecurityMetrics } from "../metrics/security-metrics-store";
import type { ComponentStatus, DomainMetricCard, QueueMonitorRow } from "../types";

function card(
  id: string,
  label: string,
  value: string | number,
  status: ComponentStatus = "healthy",
  hint?: string,
): DomainMetricCard {
  return { id, label, value, status, hint };
}

async function countTable(
  supabase: SupabaseClient,
  table: string,
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function collectAuthMetrics(
  supabase: SupabaseClient,
): Promise<DomainMetricCard[]> {
  const security = getSecurityMetrics();
  const sessions = await countTable(supabase, "profiles");
  return [
    card("failed-logins", "Failed logins", security.failedLogins, security.failedLogins > 20 ? "warning" : "healthy", "Process counters"),
    card("successful-logins", "Successful logins", security.successfulLogins),
    card("mfa-failures", "MFA failures", security.mfaFailures, security.mfaFailures > 5 ? "warning" : "healthy"),
    card("oauth-failures", "OAuth failures", security.oauthFailures),
    card("password-resets", "Password resets", security.passwordResets),
    card("invite-failures", "Invite failures", security.inviteFailures, security.inviteFailures > 0 ? "warning" : "healthy"),
    card(
      "active-sessions",
      "Profiles (proxy for accounts)",
      sessions ?? "—",
      sessions == null ? "unknown" : "healthy",
      "Auth session store not exposed; profile count as proxy",
    ),
  ];
}

export async function collectDiscoveryMetrics(
  supabase: SupabaseClient,
  queues: QueueMonitorRow[],
): Promise<DomainMetricCard[]> {
  const creators = await countTable(supabase, "influencers");
  const enrichmentActive = queues
    .filter((q) => q.name.includes("enrichment") && !q.name.includes("dlq"))
    .reduce((s, q) => s + q.active, 0);
  const enrichmentPending = queues
    .filter((q) => q.name.includes("enrichment") && !q.name.includes("dlq"))
    .reduce((s, q) => s + q.waiting + q.delayed, 0);
  const importFailed = queues
    .filter((q) => q.name.includes("import"))
    .reduce((s, q) => s + q.failed, 0);
  const discoveryWaiting = queues
    .filter((q) => q.name.startsWith("discovery"))
    .reduce((s, q) => s + q.waiting + q.active, 0);

  let dnaCoverage: string | number = "—";
  let dnaStatus: ComponentStatus = "unknown";
  try {
    const { count: dnaCount, error } = await supabase
      .from("creator_dna")
      .select("*", { count: "exact", head: true });
    if (!error && creators != null && creators > 0 && dnaCount != null) {
      dnaCoverage = `${Math.round((dnaCount / creators) * 100)}%`;
      dnaStatus = dnaCount / creators < 0.3 ? "warning" : "healthy";
    }
  } catch {
    dnaCoverage = "—";
  }

  return [
    card("creator-count", "Creator count", creators ?? "—", creators == null ? "unknown" : "healthy"),
    card("dna-coverage", "DNA coverage", dnaCoverage, dnaStatus),
    card("active-enrichments", "Active enrichments", enrichmentActive),
    card("pending-enrichments", "Pending enrichments", enrichmentPending, enrichmentPending > 100 ? "warning" : "healthy"),
    card("discovery-queue", "Discovery queue depth", discoveryWaiting),
    card("ai-searches", "AI searches", "—", "unknown", "Wire discovery search metrics"),
    card("avg-search-duration", "Avg search duration", "—", "unknown"),
    card("import-duration", "Import duration", "—", "unknown"),
    card("failed-imports", "Failed imports", importFailed, importFailed > 0 ? "warning" : "healthy"),
  ];
}

export async function collectFinanceMetrics(
  supabase: SupabaseClient,
): Promise<DomainMetricCard[]> {
  const invoices = await countTable(supabase, "invoices");
  let approvalQueue: number | null = null;
  try {
    const { count } = await supabase
      .from("approvals")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_review", "submitted"]);
    approvalQueue = count;
  } catch {
    approvalQueue = null;
  }

  let creditNotes: number | null = null;
  try {
    creditNotes = await countTable(supabase, "client_credit_notes");
  } catch {
    creditNotes = null;
  }

  return [
    card("invoice-queue", "Invoices (total)", invoices ?? "—", invoices == null ? "unknown" : "healthy"),
    card("posting-failures", "Posting failures", "—", "unknown", "Instrument posting center"),
    card("payment-sync-failures", "Payment sync failures", "—", "unknown"),
    card(
      "approval-queue",
      "Approval queue",
      approvalQueue ?? "—",
      approvalQueue == null ? "unknown" : approvalQueue > 50 ? "warning" : "healthy",
    ),
    card("credit-notes", "Credit notes", creditNotes ?? "—", creditNotes == null ? "unknown" : "healthy"),
    card("export-failures", "Export failures", "—", "unknown"),
  ];
}

export function collectStorageDomainMetrics(
  storageComponentStatus: ComponentStatus,
): DomainMetricCard[] {
  return [
    card("bucket-usage", "Bucket usage", "—", "unknown", "Supabase storage analytics API pending"),
    card("upload-failures", "Upload failures", "—", "unknown"),
    card("download-failures", "Download failures", "—", "unknown"),
    card("signed-url-failures", "Signed URL failures", "—", "unknown"),
    card(
      "storage-growth",
      "Storage probe",
      storageComponentStatus,
      storageComponentStatus,
      "Live probe status from Storage adapter",
    ),
  ];
}

export function collectSecurityDomainMetrics(): DomainMetricCard[] {
  const m = getSecurityMetrics();
  return [
    card("sec-failed-logins", "Failed logins", m.failedLogins, m.failedLogins > 20 ? "warning" : "healthy"),
    card("permission-denials", "Permission denials", m.permissionDenials),
    card("rate-limit-events", "Rate limit events", m.rateLimitEvents, m.rateLimitEvents > 50 ? "warning" : "healthy"),
    card("blocked-requests", "Blocked requests", m.blockedRequests),
    card("csrf-failures", "CSRF failures", m.csrfFailures, m.csrfFailures > 0 ? "warning" : "healthy"),
    card("ssrf-blocks", "SSRF blocks", m.ssrfBlocks),
    card("xss-sanitizations", "XSS sanitizations", m.xssSanitizations),
    card("audit-events", "Audit events", m.auditEvents),
  ];
}
