/**
 * Thinkway Intelligence ETL — load historical Excel into intelligence schema.
 *
 * Run (local dev only):
 *   npx tsx scripts/intelligence-etl/run.ts
 *
 * Env:
 *   INTELLIGENCE_EXCEL_PATH — override workbook path
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (JWT eyJ…)
 *   INTELLIGENCE_ETL_TRUNCATE=1 — clear warehouse tables before load
 *   INTELLIGENCE_ETL_DRY_RUN=1 — parse Excel and print stats; no database writes
 */
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import * as XLSX from "xlsx";

import { buildBenchmarkAggregates } from "@/lib/intelligence/benchmarks/aggregate";
import { intelligenceDb } from "@/lib/intelligence/client";
import {
  aggregateMatchConfidence,
  loadLiveMasters,
  resolveBrand,
  resolveCampaign,
  resolveClient,
  resolveInfluencer,
  type LiveMasters,
} from "@/lib/intelligence/entity-resolution/matchers";
import { parseMoney } from "@/lib/intelligence/parsers/money";
import {
  harmonizeCampaignRow,
  hashRow,
  payloadFromRow,
} from "@/lib/intelligence/parsers/harmonize";
import {
  isCampaignDataRow,
  isDatabaseDataRow,
  stripEmoji,
} from "@/lib/intelligence/parsers/row-filter";
import type { HarmonizedCampaignRow, IntelligenceSheet } from "@/types/intelligence";
import type { Database } from "@/types/database";

config({ path: ".env" });

const DEFAULT_EXCEL_PATH =
  "c:\\Users\\X13 Yoga G3\\Documents\\Thinway\\Thinkway Intelligence Engine\\data 2023 - 2026.xlsx";

const CAMPAIGN_SHEETS: IntelligenceSheet[] = ["2023", "2024", "2025", "2026"];
const BATCH_SIZE = 500;
const dryRun =
  process.env.INTELLIGENCE_ETL_DRY_RUN === "1" || process.argv.includes("--dry-run");

const EMPTY_MASTERS: LiveMasters = {
  groups: [],
  clients: [],
  brands: [],
  influencers: [],
  handles: [],
  headers: [],
  lines: [],
  overrides: [],
};

type SheetStat = { totalRows: number; filteredRows: number };

function printDryRunSummary(opts: {
  excelPath: string;
  sheetNames: string[];
  sheetStats: Map<string, SheetStat>;
  campaigns: number;
  influencers: number;
  clients: number;
  brands: number;
}) {
  const { excelPath, sheetNames, sheetStats, campaigns, influencers, clients, brands } = opts;
  const totalRaw = [...sheetStats.values()].reduce((sum, s) => sum + s.totalRows, 0);
  const totalFiltered = [...sheetStats.values()].reduce((sum, s) => sum + s.filteredRows, 0);

  console.log("");
  console.log("=== Intelligence ETL Dry Run ===");
  console.log("");
  console.log(`Excel file:          ${excelPath}`);
  console.log(`Sheets detected:     ${sheetNames.length} (${sheetNames.join(", ")})`);
  console.log("");
  console.log("Sheet                          | Raw rows | After filter");
  console.log("-------------------------------|----------|-------------");
  for (const name of sheetNames) {
    const stat = sheetStats.get(name) ?? { totalRows: 0, filteredRows: 0 };
    console.log(
      `${name.padEnd(30)} | ${String(stat.totalRows).padStart(8)} | ${String(stat.filteredRows).padStart(11)}`
    );
  }
  console.log("-------------------------------|----------|-------------");
  console.log(
    `${"TOTAL".padEnd(30)} | ${String(totalRaw).padStart(8)} | ${String(totalFiltered).padStart(11)}`
  );
  console.log("");
  console.log(`Estimated campaigns:   ${campaigns}`);
  console.log(`Estimated influencers: ${influencers}`);
  console.log(`Estimated clients:     ${clients}`);
  console.log(`Estimated brands:      ${brands}`);
  console.log("");
  console.log("Database writes:       NONE (dry run)");
  console.log("");
}

function resolveServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (key?.startsWith("eyJ")) return key;
  throw new Error(
    "Set SUPABASE_SERVICE_ROLE_KEY to the JWT service_role key. ETL bypasses RLS and must not run in production CI without intent."
  );
}

function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return createClient<Database>(url, resolveServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function truncateWarehouse(supabase: SupabaseClient<Database>) {
  const db = intelligenceDb(supabase) as {
    from: (table: string) => {
      delete: () => { neq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
    };
  };
  const tables = [
    "int_benchmarks",
    "int_margin_history",
    "int_pricing_history",
    "int_campaigns",
    "int_brands",
    "int_clients",
    "int_influencers",
    "historical_influencers_raw",
    "historical_campaigns_raw",
  ];
  for (const table of tables) {
    const { error } = await db.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(`truncate ${table}: ${error.message}`);
  }
}

function loadWorkbook(path: string) {
  const buf = readFileSync(path);
  return XLSX.read(buf, { type: "buffer", cellDates: true, dateNF: "yyyy-mm-dd" });
}

function influencerIdentityKey(
  display: string | null | undefined,
  username: string | null | undefined,
  platform: string | null | undefined
): string {
  return `${String(display ?? "").trim().toLowerCase()}|${String(username ?? "").trim().toLowerCase()}|${String(platform ?? "").trim().toLowerCase()}`;
}

function clampWarehousePercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value > 9999.9999) return 9999.9999;
  if (value < -9999.9999) return -9999.9999;
  return value;
}

function registerInfluencerDimension(opts: {
  influencerMap: Map<string, string>;
  influencerIdentityMap: Map<string, string>;
  intInfluencers: Array<Record<string, unknown>>;
  sourceKey: string;
  display: string | null | undefined;
  username: string | null | undefined;
  platform: string | null | undefined;
  record: Record<string, unknown>;
}) {
  const {
    influencerMap,
    influencerIdentityMap,
    intInfluencers,
    sourceKey,
    display,
    username,
    platform,
    record,
  } = opts;
  const identityKey = influencerIdentityKey(display, username, platform);
  const existingId = influencerIdentityMap.get(identityKey);
  if (existingId) {
    influencerMap.set(sourceKey, existingId);
    const existing = intInfluencers.find((row) => row.id === existingId);
    if (existing) {
      const keys = new Set([...(existing.source_keys as string[]), sourceKey]);
      existing.source_keys = [...keys];
    }
    return;
  }

  const id = crypto.randomUUID();
  influencerIdentityMap.set(identityKey, id);
  influencerMap.set(sourceKey, id);
  intInfluencers.push({ ...record, id });
}

type IntelligenceDb = {
  from: (table: string) => {
    select: (
      columns: string,
      opts?: { count?: "exact"; head?: boolean }
    ) => {
      range: (from: number, to: number) => Promise<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    } & Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null; count?: number | null }>;
    upsert: (
      rows: Record<string, unknown>[],
      opts?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) => Promise<{ error: { message: string } | null }>;
    insert: (rows: Record<string, unknown>[]) => Promise<{ error: { message: string } | null }>;
    delete: () => {
      neq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

async function hydrateExistingWarehouse(
  db: IntelligenceDb,
  maps: {
    clientMap: Map<string, string>;
    brandMap: Map<string, string>;
    influencerMap: Map<string, string>;
    influencerIdentityMap: Map<string, string>;
    campaignIdBySourceLine: Map<string, string>;
  }
) {
  const { data: clients, error: clientError } = await db.from("int_clients").select("id, client_name_raw, group_name_raw");
  if (clientError) throw new Error(`hydrate int_clients: ${clientError.message}`);
  for (const row of clients ?? []) {
    maps.clientMap.set(`${String(row.group_name_raw ?? "")}|${String(row.client_name_raw)}`, String(row.id));
  }

  const { data: brands, error: brandError } = await db.from("int_brands").select("id, brand_name_raw, client_name_raw");
  if (brandError) throw new Error(`hydrate int_brands: ${brandError.message}`);
  for (const row of brands ?? []) {
    maps.brandMap.set(`${String(row.brand_name_raw)}|${String(row.client_name_raw ?? "")}`, String(row.id));
  }

  let influencerOffset = 0;
  while (true) {
    const { data: influencers, error: influencerError } = await db
      .from("int_influencers")
      .select("id, display_name_raw, username, platform, source_keys")
      .range(influencerOffset, influencerOffset + BATCH_SIZE - 1);
    if (influencerError) throw new Error(`hydrate int_influencers: ${influencerError.message}`);
    if (!influencers?.length) break;
    for (const row of influencers) {
      const id = String(row.id);
      const identityKey = influencerIdentityKey(
        row.display_name_raw as string | null | undefined,
        row.username as string | null | undefined,
        row.platform as string | null | undefined
      );
      maps.influencerIdentityMap.set(identityKey, id);
      for (const sourceKey of (row.source_keys as string[] | null) ?? []) {
        maps.influencerMap.set(sourceKey, id);
      }
    }
    if (influencers.length < BATCH_SIZE) break;
    influencerOffset += BATCH_SIZE;
  }

  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from("int_campaigns")
      .select("id, source_line_id")
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) throw new Error(`hydrate int_campaigns: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      maps.campaignIdBySourceLine.set(String(row.source_line_id), String(row.id));
    }
    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(
    `[intelligence-etl] Hydrated existing warehouse: ${maps.clientMap.size} clients, ${maps.brandMap.size} brands, ${maps.influencerIdentityMap.size} influencers, ${maps.campaignIdBySourceLine.size} campaigns`
  );
}

async function loadMastersForRun(): Promise<LiveMasters> {
  if (dryRun) {
    try {
      return await loadLiveMasters(createAdminClient());
    } catch {
      console.log(
        "[intelligence-etl] Dry-run: Supabase unavailable — entity resolution uses empty masters."
      );
      return EMPTY_MASTERS;
    }
  }
  return loadLiveMasters(createAdminClient());
}

async function main() {
  const excelPath = process.env.INTELLIGENCE_EXCEL_PATH?.trim() || DEFAULT_EXCEL_PATH;

  if (dryRun) {
    console.log("[intelligence-etl] DRY RUN — no database writes");
  }

  const supabase = dryRun ? null : createAdminClient();
  const db = supabase ? (intelligenceDb(supabase) as IntelligenceDb) : null;

  console.log(`[intelligence-etl] Reading ${excelPath}`);
  const wb = loadWorkbook(excelPath);
  const sheetStats = new Map<string, SheetStat>();

  for (const name of wb.SheetNames) {
    sheetStats.set(name, { totalRows: 0, filteredRows: 0 });
  }

  if (!dryRun && process.env.INTELLIGENCE_ETL_TRUNCATE === "1") {
    console.log("[intelligence-etl] Truncating warehouse tables…");
    await truncateWarehouse(supabase!);
  }

  const loadedAt = new Date().toISOString();

  // --- Raw campaign rows ---
  const rawCampaignRows: Array<Record<string, unknown>> = [];
  const harmonized: HarmonizedCampaignRow[] = [];

  for (const sheet of CAMPAIGN_SHEETS) {
    if (!wb.SheetNames.includes(sheet)) continue;
    const ws = wb.Sheets[sheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    let kept = 0;
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      if (!isCampaignDataRow(row, sheet)) return;
      kept += 1;
      const payload = payloadFromRow(row);
      rawCampaignRows.push({
        source_sheet: sheet,
        source_row_number: rowNumber,
        loaded_at: loadedAt,
        payload,
        row_hash: hashRow(sheet, rowNumber, payload),
      });
      harmonized.push(harmonizeCampaignRow(sheet, row, rowNumber));
    });
    sheetStats.set(sheet, { totalRows: rows.length, filteredRows: kept });
    console.log(`[intelligence-etl] ${sheet}: ${kept}/${rows.length} data rows`);
  }

  if (!dryRun && db) {
    for (let i = 0; i < rawCampaignRows.length; i += BATCH_SIZE) {
      const chunk = rawCampaignRows.slice(i, i + BATCH_SIZE);
      const { error } = await db
        .from("historical_campaigns_raw")
        .upsert(chunk, { onConflict: "source_sheet,source_row_number,row_hash", ignoreDuplicates: true });
      if (error) throw new Error(`historical_campaigns_raw: ${error.message}`);
    }
  }

  // --- Raw influencer database ---
  const rawInfluencerRows: Array<Record<string, unknown>> = [];
  if (wb.SheetNames.includes("Database")) {
    const ws = wb.Sheets.Database;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      if (!isDatabaseDataRow(row)) return;
      const payload = payloadFromRow(row);
      rawInfluencerRows.push({
        source_row_number: rowNumber,
        loaded_at: loadedAt,
        payload,
        row_hash: hashRow("Database", rowNumber, payload),
      });
    });
    if (!dryRun && db) {
      for (let i = 0; i < rawInfluencerRows.length; i += BATCH_SIZE) {
        const chunk = rawInfluencerRows.slice(i, i + BATCH_SIZE);
        const { error } = await db
          .from("historical_influencers_raw")
          .upsert(chunk, { onConflict: "source_row_number,row_hash", ignoreDuplicates: true });
        if (error) throw new Error(`historical_influencers_raw: ${error.message}`);
      }
    }
    const dbRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
    sheetStats.set("Database", { totalRows: dbRows.length, filteredRows: rawInfluencerRows.length });
    console.log(`[intelligence-etl] Database: ${rawInfluencerRows.length} vendor rows`);
  }

  const masters = await loadMastersForRun();

  // --- Dimension tables ---
  const clientMap = new Map<string, string>();
  const brandMap = new Map<string, string>();
  const influencerMap = new Map<string, string>();
  const influencerIdentityMap = new Map<string, string>();

  const intClients: Array<Record<string, unknown>> = [];
  const intBrands: Array<Record<string, unknown>> = [];
  const intInfluencers: Array<Record<string, unknown>> = [];
  const campaignIdBySourceLine = new Map<string, string>();

  if (!dryRun && db && process.env.INTELLIGENCE_ETL_TRUNCATE !== "1") {
    await hydrateExistingWarehouse(db, {
      clientMap,
      brandMap,
      influencerMap,
      influencerIdentityMap,
      campaignIdBySourceLine,
    });
  }

  for (const row of harmonized) {
    if (row.client_name_raw) {
      const key = `${row.group_name_raw ?? ""}|${row.client_name_raw}`;
      if (!clientMap.has(key)) {
        const resolved = resolveClient(masters, row.client_name_raw, row.group_name_raw);
        const id = crypto.randomUUID();
        clientMap.set(key, id);
        intClients.push({
          id,
          client_name_raw: row.client_name_raw,
          group_name_raw: row.group_name_raw,
          client_type_report: row.client_type_report,
          category_raw: row.category_raw,
          subcategory_raw: row.subcategory_raw,
          resolved_group_id: resolved.resolvedGroupId,
          resolved_client_id: resolved.resolvedClientId,
          match_confidence: resolved.confidence,
          source_keys: [key],
        });
      }
    }

    if (row.brand_name_raw) {
      const key = `${row.brand_name_raw}|${row.client_name_raw ?? ""}`;
      if (!brandMap.has(key)) {
        const clientKey = `${row.group_name_raw ?? ""}|${row.client_name_raw ?? ""}`;
        const clientId = clientMap.get(clientKey);
        const clientResolved = intClients.find((c) => c.id === clientId) as
          | { resolved_client_id?: string | null }
          | undefined;
        const resolved = resolveBrand(
          masters,
          row.brand_name_raw,
          clientResolved?.resolved_client_id ?? null
        );
        const id = crypto.randomUUID();
        brandMap.set(key, id);
        intBrands.push({
          id,
          brand_name_raw: row.brand_name_raw,
          client_name_raw: row.client_name_raw,
          commercial_model: row.direct_agency,
          category_raw: row.category_raw,
          subcategory_raw: row.subcategory_raw,
          resolved_brand_id: resolved.resolvedBrandId,
          match_confidence: resolved.confidence,
          source_keys: [key],
        });
      }
    }

    if (row.influencer_name_raw) {
      const key = `${row.influencer_name_raw}|`;
      if (!influencerMap.has(key)) {
        const resolved = resolveInfluencer(masters, row.influencer_name_raw, null);
        registerInfluencerDimension({
          influencerMap,
          influencerIdentityMap,
          intInfluencers,
          sourceKey: key,
          display: row.influencer_name_raw,
          username: null,
          platform: row.channel,
          record: {
            display_name_raw: row.influencer_name_raw,
            platform: row.channel,
            resolved_influencer_id: resolved.resolvedInfluencerId,
            match_confidence: resolved.confidence,
            source_keys: [key],
          },
        });
      }
    }
  }

  // Database sheet influencers
  if (wb.SheetNames.includes("Database")) {
    const ws = wb.Sheets.Database;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
    for (const row of rows) {
      if (!isDatabaseDataRow(row)) continue;
      const display =
        String(row["Influencer NEW name"] ?? row["Influencer OLD Name"] ?? "").trim() || null;
      const username = String(row.Username ?? "").trim() || null;
      const key = `${display ?? ""}|${username ?? ""}`;
      if (influencerMap.has(key)) continue;
      const resolved = resolveInfluencer(masters, display, username);
      registerInfluencerDimension({
        influencerMap,
        influencerIdentityMap,
        intInfluencers,
        sourceKey: key,
        display,
        username,
        platform: String(row.Platform ?? "").trim() || null,
        record: {
          display_name_raw: display ?? username ?? "Unknown",
          legacy_name: String(row["Influencer OLD Name"] ?? "").trim() || null,
          username,
          platform: String(row.Platform ?? "").trim() || null,
          country: String(row.Country ?? "").trim() || null,
          nationality: String(row.Nationality ?? "").trim() || null,
          gender: String(row.Gender ?? "").trim() || null,
          tier: String(row["Influencer Type"] ?? "").trim() || null,
          content_category: stripEmoji(String(row.Category ?? "").trim() || null),
          resolved_influencer_id: resolved.resolvedInfluencerId,
          match_confidence: resolved.confidence,
          source_keys: [key],
        },
      });
    }
  }

  for (const table of ["int_clients", "int_brands", "int_influencers"] as const) {
    const payload =
      table === "int_clients" ? intClients : table === "int_brands" ? intBrands : intInfluencers;
    if (!dryRun && db && payload.length > 0) {
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const chunk = payload.slice(i, i + BATCH_SIZE);
        const { error } = await db.from(table).insert(chunk);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    }
    console.log(`[intelligence-etl] ${table}: ${payload.length} rows`);
  }

  // --- Campaign facts ---
  const intCampaigns: Array<Record<string, unknown>> = [];
  const intMarginHistory: Array<Record<string, unknown>> = [];
  const intPricingHistory: Array<Record<string, unknown>> = [];

  for (const row of harmonized) {
    const clientKey = `${row.group_name_raw ?? ""}|${row.client_name_raw ?? ""}`;
    const brandKey = `${row.brand_name_raw ?? ""}|${row.client_name_raw ?? ""}`;
    const influencerKey = `${row.influencer_name_raw ?? ""}|`;

    const clientResolved = resolveClient(masters, row.client_name_raw, row.group_name_raw);
    const brandResolved = resolveBrand(masters, row.brand_name_raw, clientResolved.resolvedClientId);
    const influencerResolved = resolveInfluencer(masters, row.influencer_name_raw, null);
    const campaignResolved = resolveCampaign(masters, row);

    const matchConfidence = aggregateMatchConfidence([
      clientResolved.confidence,
      brandResolved.confidence,
      influencerResolved.confidence,
      campaignResolved.confidence,
    ]);

    const campaignId = campaignIdBySourceLine.get(row.source_line_id) ?? crypto.randomUUID();
    intCampaigns.push({
      id: campaignId,
      ...row,
      margin_pct: clampWarehousePercent(row.margin_pct),
      markup_pct: clampWarehousePercent(row.markup_pct),
      int_client_id: clientMap.get(clientKey) ?? null,
      int_brand_id: brandMap.get(brandKey) ?? null,
      int_influencer_id: influencerMap.get(influencerKey) ?? null,
      resolved_header_id: campaignResolved.resolvedHeaderId,
      resolved_line_id: campaignResolved.resolvedLineId,
      match_confidence: matchConfidence,
    });

    if (row.revenue_usd != null || row.cost_usd != null) {
      intMarginHistory.push({
        int_campaign_id: campaignId,
        source_line_id: row.source_line_id,
        revenue_usd: row.revenue_usd,
        cost_usd: row.cost_usd,
        gp_usd: row.gp_usd,
        margin_pct: clampWarehousePercent(row.margin_pct),
        markup_pct: clampWarehousePercent(row.markup_pct),
        market_entity: row.market_entity,
        channel: row.channel,
        campaign_type: row.campaign_type,
        category_raw: row.category_raw,
        brand_name_raw: row.brand_name_raw,
        below_threshold_15pct: row.margin_pct != null && row.margin_pct < 15,
        period_year: row.period_year,
      });
    }

    if (row.cost_usd != null && row.cost_usd > 0 && row.influencer_name_raw) {
      const infId = influencerMap.get(influencerKey);
      if (infId) {
        intPricingHistory.push({
          int_influencer_id: infId,
          parsed_rate_usd: row.cost_usd,
          platform: row.channel,
          effective_period: row.ad_live_month ?? String(row.period_year ?? ""),
          source: "implied_from_line",
        });
      }
    }
  }

  if (!dryRun && db) {
    for (let i = 0; i < intCampaigns.length; i += BATCH_SIZE) {
      const chunk = intCampaigns.slice(i, i + BATCH_SIZE);
      const { error } = await db.from("int_campaigns").upsert(chunk, { onConflict: "source_line_id" });
      if (error) throw new Error(`int_campaigns: ${error.message}`);
    }

    for (let i = 0; i < intMarginHistory.length; i += BATCH_SIZE) {
      const chunk = intMarginHistory.slice(i, i + BATCH_SIZE);
      const { error } = await db.from("int_margin_history").upsert(chunk, { onConflict: "int_campaign_id" });
      if (error) throw new Error(`int_margin_history: ${error.message}`);
    }
  }

  // Database rate text → pricing history
  if (wb.SheetNames.includes("Database")) {
    const ws = wb.Sheets.Database;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: false });
    for (const row of rows) {
      if (!isDatabaseDataRow(row)) continue;
      const display =
        String(row["Influencer NEW name"] ?? row["Influencer OLD Name"] ?? "").trim() || null;
      const username = String(row.Username ?? "").trim() || null;
      const key = `${display ?? ""}|${username ?? ""}`;
      const infId = influencerMap.get(key);
      if (!infId) continue;

      for (const [col, source] of [
        ["New Rate", "database_sheet"],
        ["NEW PACKAGES", "database_sheet"],
        ["(old) rates for 1 ad", "database_sheet"],
      ] as const) {
        const text = String(row[col] ?? "").trim();
        if (!text) continue;
        intPricingHistory.push({
          int_influencer_id: infId,
          rate_text: text,
          parsed_rate_usd: parseMoney(text),
          currency: String(row["Bank Acc Currency"] ?? "").trim() || null,
          platform: String(row.Platform ?? "").trim() || null,
          effective_period: "database",
          source,
        });
      }
    }
  }

  if (!dryRun && db) {
    const skipPricingReload = process.env.INTELLIGENCE_ETL_TRUNCATE !== "1";
    if (skipPricingReload) {
      const { count, error: countError } = await db
        .from("int_pricing_history")
        .select("id", { count: "exact", head: true });
      if (countError) throw new Error(`int_pricing_history count: ${countError.message}`);
      if ((count ?? 0) > 0) {
        console.log(
          `[intelligence-etl] Skipping int_pricing_history insert (${count} rows already loaded; non-truncate re-run)`
        );
      } else {
        for (let i = 0; i < intPricingHistory.length; i += BATCH_SIZE) {
          const chunk = intPricingHistory.slice(i, i + BATCH_SIZE);
          const { error } = await db.from("int_pricing_history").insert(chunk);
          if (error) throw new Error(`int_pricing_history: ${error.message}`);
        }
      }
    } else {
      for (let i = 0; i < intPricingHistory.length; i += BATCH_SIZE) {
        const chunk = intPricingHistory.slice(i, i + BATCH_SIZE);
        const { error } = await db.from("int_pricing_history").insert(chunk);
        if (error) throw new Error(`int_pricing_history: ${error.message}`);
      }
    }
  }

  console.log(
    `[intelligence-etl] int_campaigns: ${intCampaigns.length}, margin: ${intMarginHistory.length}, pricing: ${intPricingHistory.length}`
  );

  // --- Benchmarks ---
  const influencerTierById = new Map(
    intInfluencers.map((row) => [row.id as string, (row.tier as string | null) ?? null])
  );

  const benchmarkInputs = intCampaigns.map((row) => ({
    platform: (row.channel as string | null) ?? null,
    category: (row.category_raw as string | null) ?? null,
    market_entity: (row.market_entity as string | null) ?? null,
    tier: influencerTierById.get((row.int_influencer_id as string) ?? "") ?? null,
    period_year: (row.period_year as number | null) ?? null,
    cost_usd: (row.cost_usd as number | null) ?? null,
    revenue_usd: (row.revenue_usd as number | null) ?? null,
    margin_pct: (row.margin_pct as number | null) ?? null,
  }));

  const aggregates = buildBenchmarkAggregates(benchmarkInputs);
  const benchmarkRows = aggregates.map((agg) => ({
    ...agg,
    computed_at: loadedAt,
  }));

  if (!dryRun && db) {
    const { error: benchError } = await db.from("int_benchmarks").upsert(benchmarkRows, {
      onConflict: "benchmark_key,period_year",
    });
    if (benchError) throw new Error(`int_benchmarks: ${benchError.message}`);
  }

  console.log(`[intelligence-etl] int_benchmarks: ${benchmarkRows.length} slices`);

  if (dryRun) {
    printDryRunSummary({
      excelPath,
      sheetNames: wb.SheetNames,
      sheetStats,
      campaigns: intCampaigns.length,
      influencers: influencerMap.size,
      clients: clientMap.size,
      brands: brandMap.size,
    });
  } else {
    console.log("[intelligence-etl] Complete.");
  }
}

main().catch((err) => {
  console.error("[intelligence-etl] Failed:", err);
  process.exit(1);
});
