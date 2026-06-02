import type { SupabaseClient } from "@supabase/supabase-js";

import { getAnalyticsCacheStats } from "@/lib/analytics/aggregations/memo";
import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { loadBillingCampaignQueue } from "@/lib/billing/operational-billing-query";
import { getPlanningCacheStats } from "@/lib/planning/queries/planning-cache";
import { devLog, startTimer } from "@/lib/platform/logger";
import type { HealthCheck, PlatformHealthReport } from "@/lib/platform/health/types";
import { worstStatus } from "@/lib/platform/health/types";
import {
  isMissingColumnError,
  isMissingTableError,
} from "@/lib/platform/schema-validation";

async function runCheck(
  section: HealthCheck["section"],
  id: string,
  label: string,
  fn: () => Promise<Omit<HealthCheck, "id" | "section" | "label" | "durationMs">>
): Promise<HealthCheck> {
  const started = startTimer();
  try {
    const result = await fn();
    return {
      id,
      section,
      label,
      durationMs: Math.round(performance.now() - started),
      ...result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id,
      section,
      label,
      status: "error",
      message,
      hint: "Check server logs and Supabase connectivity.",
      durationMs: Math.round(performance.now() - started),
    };
  }
}

export async function runPlatformHealthChecks(
  supabase: SupabaseClient
): Promise<PlatformHealthReport> {
  const checks: HealthCheck[] = [];

  checks.push(
    await runCheck("database", "db_connectivity", "Database connectivity", async () => {
      const { error } = await supabase.from("clients").select("id").limit(1);
      if (error) {
        return {
          status: "error",
          message: error.message,
          hint: "Verify Supabase URL, keys, and network.",
        };
      }
      return { status: "ok", message: "Connected — clients table readable." };
    })
  );

  checks.push(
    await runCheck("migrations", "planning_tables", "Planning schema", async () => {
      const { error } = await supabase
        .from("budget_versions")
        .select("id")
        .limit(1);
      if (error) {
        const missing = isMissingTableError(error.message);
        return {
          status: missing ? "warning" : "error",
          message: error.message,
          hint: missing
            ? "Run supabase db push for 20260531700000_financial_planning_engine.sql"
            : undefined,
        };
      }
      return { status: "ok", message: "budget_versions table present." };
    })
  );

  checks.push(
    await runCheck("analytics", "analytics_facts", "Analytics facts loader", async () => {
      const snapshot = await safeLoadAnalyticsFacts(supabase);
      if (snapshot.facts.length === 0) {
        return {
          status: "warning",
          message: "No analytics facts loaded (empty or degraded).",
          hint: "Operational ERP still works; check campaign_headers embed columns.",
        };
      }
      return {
        status: "ok",
        message: `${snapshot.facts.length} campaign fact(s) loaded.`,
      };
    })
  );

  checks.push(
    await runCheck("billing", "billing_lines", "Billing lines", async () => {
      const { count, error } = await supabase
        .from("campaign_lines")
        .select("id", { count: "exact", head: true });
      if (error) {
        return { status: "error", message: error.message };
      }
      return {
        status: "ok",
        message: `${count ?? 0} campaign line(s) in scope.`,
      };
    })
  );

  checks.push(
    await runCheck("billing", "operational_queue", "Operational billing queue", async () => {
      try {
        const { campaigns } = await loadBillingCampaignQueue(supabase);
        return {
          status: "ok",
          message: `${campaigns.length} queue row(s) materialized.`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          status: "warning",
          message,
          hint: "Queue may fall back to line-based builder.",
        };
      }
    })
  );

  checks.push(
    await runCheck("planning", "planning_versions", "Planning versions", async () => {
      const { count, error } = await supabase
        .from("budget_versions")
        .select("id", { count: "exact", head: true });
      if (error) {
        return {
          status: "skipped",
          message: "Planning tables not available.",
          hint: "Apply planning migration when ready.",
        };
      }
      return {
        status: "ok",
        message: `${count ?? 0} budget version(s).`,
      };
    })
  );

  checks.push(
    await runCheck("invoices", "invoice_headers", "Invoice engine", async () => {
      const { count, error } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .not("status", "eq", "void");
      if (error) {
        return { status: "error", message: error.message };
      }
      return {
        status: "ok",
        message: `${count ?? 0} active invoice(s).`,
      };
    })
  );

  checks.push(
    await runCheck("invoices", "orphan_invoices", "Orphan invoice detection", async () => {
      const { data: orphans, error } = await supabase
        .from("invoices")
        .select("id, document_number")
        .not("status", "eq", "void")
        .is("campaign_header_id", null)
        .limit(20);

      if (error) {
        return { status: "warning", message: error.message };
      }

      const count = orphans?.length ?? 0;
      if (count > 0) {
        return {
          status: "warning",
          message: `${count}+ invoice(s) without campaign link.`,
          hint: "Review orphan invoices in finance audit.",
        };
      }
      return { status: "ok", message: "No orphan invoices in sample." };
    })
  );

  checks.push(
    await runCheck("invoices", "line_integrity", "Invoice line integrity", async () => {
      const { count, error } = await supabase
        .from("invoice_line_items")
        .select("id", { count: "exact", head: true });
      if (error) {
        const missing = isMissingColumnError(error.message) || isMissingTableError(error.message);
        return {
          status: missing ? "warning" : "error",
          message: error.message,
          hint: missing ? "Apply billing invoice line items migration." : undefined,
        };
      }
      return {
        status: "ok",
        message: `${count ?? 0} invoice line item(s).`,
      };
    })
  );

  checks.push(
    await runCheck("permissions", "rls_session", "RLS / session", async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        return {
          status: "warning",
          message: error?.message ?? "No authenticated user in health probe.",
          hint: "Health page requires login.",
        };
      }
      return { status: "ok", message: `Session active (${user.email ?? user.id}).` };
    })
  );

  checks.push(
    await runCheck("cache", "analytics_cache", "Analytics cache", async () => {
      const stats = getAnalyticsCacheStats();
      const planning = getPlanningCacheStats();
      return {
        status: "ok",
        message: `Analytics: ${stats.entries} entries (${stats.namespaces.join(", ") || "none"}). Planning cache: ${planning.entries}.`,
      };
    })
  );

  const report: PlatformHealthReport = {
    generated_at: new Date().toISOString(),
    checks,
    overall: worstStatus(checks),
  };

  devLog("platform-health", "health report generated", {
    overall: report.overall,
    checks: checks.length,
  });

  return report;
}
