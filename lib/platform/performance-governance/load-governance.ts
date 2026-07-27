import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type BudgetLimit = { soft: number; hard: number };

export type PerformanceBudgets = {
  version: number;
  description?: string;
  bundle: Record<string, BudgetLimit>;
  source: Record<string, BudgetLimit>;
  regression?: Record<string, BudgetLimit>;
  routes?: { tracked: string[]; notes?: string };
};

export type PerformanceBaseline = {
  capturedAt: string;
  gitRef?: string;
  bundle: {
    largestJsKb: number;
    largestCssKb: number;
    totalJsKb: number;
    totalCssKb: number;
    assetsOver100kb: number;
    jsFileCount: number;
    cssFileCount?: number;
  };
  source: {
    rootGlobalCssKb: number;
    clientModuleCount: number;
    largestClientSourceKb: number;
    largestClientSourceFile?: string;
  };
  discoveryBrowse?: Record<string, unknown>;
  mediaProxy?: Record<string, unknown>;
  notes?: string[];
};

export type PerformanceReport = {
  version: number;
  capturedAt: string;
  gitSha?: string | null;
  gitRef?: string | null;
  bundle: {
    largestJsKb: number;
    largestCssKb: number;
    totalJsKb: number;
    totalCssKb: number;
    assetsOver100kb: number;
    jsFileCount: number;
    cssFileCount: number;
    largestJs: Array<{ file: string; kb: number }>;
    largestCss: Array<{ file: string; kb: number }>;
  };
  source: {
    rootGlobalCssKb: number;
    clientModuleCount: number | null;
    largestClientSourceKb: number | null;
    largestClientSourceFile: string | null;
  };
  comparison: {
    against: string;
    largestJsKbDelta: number | null;
    largestCssKbDelta: number | null;
    totalJsKbDelta: number | null;
    largestJsKbPct: number | null;
    largestCssKbPct: number | null;
    totalJsKbPct: number | null;
  } | null;
  routes?: { tracked: string[]; note?: string | null };
};

export type BudgetCheckReport = {
  capturedAt: string;
  score: number;
  results: {
    fails: Array<{ name: string; value: number; soft: number; hard: number; status: string }>;
    warns: Array<{ name: string; value: number; soft: number; hard: number; status: string }>;
    passes: Array<{ name: string; value: number; soft: number; hard: number; status: string }>;
  };
};

function readJson<T>(rel: string): T | null {
  const full = join(/* turbopackIgnore: true */ process.cwd(), rel);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

export function loadPerformanceGovernance() {
  return {
    budgets: readJson<PerformanceBudgets>("performance/budgets.json"),
    baseline: readJson<PerformanceBaseline>("performance/baseline.json"),
    report: readJson<PerformanceReport>("performance/reports/latest.json"),
    check: readJson<BudgetCheckReport>("performance/reports/latest-check.json"),
    rumSlos: readJson<Record<string, unknown>>("performance/monitoring/rum-slos.json"),
    apiSlos: readJson<Record<string, unknown>>("performance/monitoring/api-slos.json"),
    sqlSlos: readJson<Record<string, unknown>>("performance/monitoring/sql-slos.json"),
  };
}

export function budgetStatus(
  value: number | null | undefined,
  limits: BudgetLimit | undefined,
): "pass" | "warn" | "fail" | "unknown" {
  if (value == null || !limits) return "unknown";
  if (value > limits.hard) return "fail";
  if (value > limits.soft) return "warn";
  return "pass";
}
