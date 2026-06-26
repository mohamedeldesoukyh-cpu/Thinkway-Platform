#!/usr/bin/env node
/**
 * Verify campaign_publications schema against Campaign Performance Center requirements.
 * Run: npm run verify:campaign-performance
 *
 * Uses scripts/run-verify-campaign-performance.mjs (Node --use-system-ca for Windows TLS).
 * Falls back to `supabase db query --linked` when REST is unreachable.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS,
  CAMPAIGN_PUBLICATIONS_EXPECTED_MIGRATION,
  CAMPAIGN_PUBLICATIONS_TABLE,
  partitionSchemaColumns,
} from "../lib/campaigns/campaign-publications-schema";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";

if (existsSync(path.join(root, ".env.local"))) {
  config({ path: path.join(root, ".env.local") });
}
config({ path: path.join(root, ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function pass(label: string, detail = "") {
  console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail = "") {
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

function formatPostgrestError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const e = error as { message?: string; code?: string; hint?: string };
    const parts = [e.message ?? "Unknown error"];
    if (e.code) parts.push(`code=${e.code}`);
    if (e.hint) parts.push(e.hint);
    return parts.join(" | ");
  }
  return formatFetchError(error);
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: string; message?: string } | undefined;
  const parts = [error.message];
  if (cause?.code) parts.push(`code=${cause.code}`);
  if (cause?.message && cause.message !== error.message) parts.push(cause.message);
  if (error.message.includes("fetch failed") && cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    parts.push(
      "Node TLS could not verify Supabase certificate — npm script uses node --use-system-ca; retry or use CLI fallback"
    );
  }
  return parts.join(" | ");
}

function parseSupabaseCliColumns(output: string): string[] {
  const trimmed = output.trim();
  const jsonStart = trimmed.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart)) as {
        rows?: Array<{ column_name?: string }>;
      };
      if (parsed.rows?.length) {
        return parsed.rows.map((row) => row.column_name ?? "").filter(Boolean);
      }
    } catch {
      // fall through to legacy table parsing
    }
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const columns: string[] = [];

  for (const line of lines) {
    if (/^[-+|]+$/.test(line.replace(/\s/g, ""))) continue;
    if (/^column_name$/i.test(line)) continue;

    const pipeCells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (pipeCells.length === 1 && pipeCells[0]) {
      columns.push(pipeCells[0]);
      continue;
    }

    const cells = line.split(/\s+/).filter(Boolean);
    if (cells.length === 1 && cells[0] && cells[0] !== "column_name") {
      columns.push(cells[0]);
    }
  }

  return columns;
}

async function fetchColumnsViaCli(): Promise<Set<string> | null> {
  const sql = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${CAMPAIGN_PUBLICATIONS_TABLE}' ORDER BY ordinal_position;`;

  try {
    const output = execSync(`npx supabase db query --linked ${JSON.stringify(sql)}`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120_000,
    });

    const names = parseSupabaseCliColumns(output).filter(Boolean);
    return names.length > 0 ? new Set(names) : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`WARN  supabase db query fallback failed — ${message.split("\n")[0]}`);
    return null;
  }
}

async function fetchColumnsViaRest(
  supabase: ReturnType<typeof createClient>
): Promise<{ columns: Set<string> | null; rpcError?: string }> {
  const { data, error } = await supabase.rpc("list_public_table_columns", {
    p_table: CAMPAIGN_PUBLICATIONS_TABLE,
  });

  if (!error && data && Array.isArray(data) && data.length > 0) {
    return {
      columns: new Set(
        data.map((row: { column_name?: string } | string) =>
          typeof row === "string" ? row : (row.column_name ?? "")
        )
      ),
    };
  }

  if (error) {
    return { columns: null, rpcError: formatPostgrestError(error) };
  }

  console.log("WARN  Probing columns individually via REST");
  const available = new Set<string>();

  for (const column of CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS) {
    const { error: probeError } = await supabase
      .from(CAMPAIGN_PUBLICATIONS_TABLE)
      .select(column)
      .limit(0);

    if (!probeError) available.add(column);
  }

  return { columns: available.size > 0 ? available : null };
}

async function checkTableViaRest(
  supabase: ReturnType<typeof createClient>
): Promise<{ ok: boolean; error?: string; permissionDenied?: boolean }> {
  const { error } = await supabase.from(CAMPAIGN_PUBLICATIONS_TABLE).select("id").limit(1);

  if (!error) return { ok: true };
  const formatted = formatPostgrestError(error);
  return {
    ok: false,
    error: formatted,
    permissionDenied: formatted.includes("permission denied") || formatted.includes("code=42501"),
  };
}

async function main() {
  console.log("\n=== Campaign Performance — Schema Verification ===\n");
  console.log(`Table: public.${CAMPAIGN_PUBLICATIONS_TABLE}`);
  console.log(`Expected migration: ${CAMPAIGN_PUBLICATIONS_EXPECTED_MIGRATION}\n`);

  if (!url || !serviceKey) {
    fail("Environment", "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    console.log("\nSet credentials in .env.local or .env, then retry.\n");
    process.exit(1);
  }

  pass("Environment variables present", new URL(url).host);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let available: Set<string> | null = null;
  let transport = "rest";

  const restSchema = await fetchColumnsViaRest(supabase);
  if (restSchema.columns && restSchema.columns.size > 0) {
    available = restSchema.columns;
    pass("Schema readable (REST RPC list_public_table_columns)");
  } else if (restSchema.rpcError) {
    console.log(`WARN  list_public_table_columns RPC — ${restSchema.rpcError}`);
  }

  const tableCheck = await checkTableViaRest(supabase);
  if (tableCheck.ok) {
    pass("Table accessible (REST SELECT)");
  } else if (tableCheck.permissionDenied && available) {
    console.log(
      `WARN  Table SELECT denied for service_role — apply migration 20260623130000_campaign_publications_grants.sql`
    );
  } else if (!available) {
    fail("Table accessible (REST)", tableCheck.error);
  } else {
    console.log(`WARN  Table SELECT — ${tableCheck.error}`);
  }

  if (!available) {
    console.log("\nTrying Supabase CLI fallback (linked project)…\n");
    transport = "cli";
    available = await fetchColumnsViaCli();
    if (available && available.size > 0) {
      pass("Table schema readable (supabase db query --linked)");
    } else {
      console.log("\nResult: INCOMPATIBLE — could not read schema via REST or CLI\n");
      console.log("Tips:");
      console.log("  • Ensure linked project: npx supabase link");
      console.log("  • On Windows, REST needs system CA (set automatically by npm script)");
      console.log("  • Check VPN/firewall access to Supabase\n");
      process.exit(1);
    }
  }

  if (!available || available.size === 0) {
    fail("Column inventory", "no columns returned");
    process.exit(1);
  }

  pass(`Column inventory via ${transport}`, `${available.size} columns`);

  const partition = partitionSchemaColumns(available);

  console.log("\nExisting columns:");
  for (const col of [...available].sort()) {
    console.log(`  • ${col}`);
  }

  console.log("\nMissing application columns:");
  const missingApp = CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS.filter((c) => !available!.has(c));
  if (missingApp.length === 0) {
    pass("All application columns present");
  } else {
    for (const col of missingApp) {
      fail(`Missing column: ${col}`);
    }
  }

  if (partition.missingRequired.length > 0) {
    console.log("\nMissing REQUIRED columns:");
    for (const col of partition.missingRequired) fail(col);
  }

  if (partition.missingMetrics.length > 0) {
    console.log("\nMissing METRIC columns:");
    for (const col of partition.missingMetrics) console.log(`  • ${col}`);
  }

  if (partition.missingSync.length > 0) {
    console.log("\nMissing SYNC columns:");
    for (const col of partition.missingSync) console.log(`  • ${col}`);
  }

  const compatible = partition.isCompatible;
  const metricsReady = partition.missingMetrics.length === 0;

  console.log("\nCompatibility:");
  if (compatible) pass("Core Performance Center load");
  else fail("Core Performance Center load", "required columns missing");

  if (metricsReady) pass("Full metrics + KPI aggregation");
  else fail("Full metrics + KPI aggregation", `${partition.missingMetrics.length} metric columns missing`);

  if (!partition.missingLegacy.includes("engagement_views")) {
    pass("Legacy engagement_views column");
  } else {
    fail("Legacy engagement_views column", "not present (canonical views/likes used instead)");
  }

  console.log(
    `\nResult: ${compatible ? (metricsReady ? "FULLY COMPATIBLE" : "PARTIAL — apply migration for metrics") : "INCOMPATIBLE"}\n`
  );

  if (!compatible || !metricsReady) {
    console.log(`Apply: supabase/migrations/${CAMPAIGN_PUBLICATIONS_EXPECTED_MIGRATION}`);
    console.log("Then run: npx supabase db push --include-all\n");
    process.exit(compatible ? 0 : 1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(formatFetchError(error));
  process.exit(1);
});
