/**
 * Rebuild campaign-line assignment platforms + assignment_deliverables from the
 * source quotation item types (fixes type×platform explosion after convert).
 *
 * Development only (hsxrewjcbvmbkqdlzjhs).
 *
 *   npx tsx scripts/repair-assignment-types-from-quotation.ts --dry-run --campaign=TW-2026-0005
 *   npx tsx scripts/repair-assignment-types-from-quotation.ts --execute --campaign=TW-2026-0005
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  LINE_ASSIGNMENT_META_KEY,
  parseLineAssignment,
  type LineInfluencerAssignment,
} from "@/lib/campaigns/line-assignment";
import {
  quotationDeliverablesToPlatforms,
  type QuotationItemExecutionRow,
} from "@/lib/domains/commercial/quotation-execution-mapper";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import type { ResolvedLineCommercialInput } from "@/lib/assignments/resolve-line-commercial-input";
import { syncAssignmentDeliverablesForLine } from "@/lib/assignments/sync-assignment-deliverables-for-line";

const DEV_REF = "hsxrewjcbvmbkqdlzjhs";

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(".env.local");
loadEnv(".env");

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string): string | null {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

function parseDeliverables(raw: unknown): QuotationDeliverable[] {
  if (!Array.isArray(raw)) return [];
  return raw as QuotationDeliverable[];
}

/** Update campaign_lines.metadata as postgres (service-role hits financial_periods RLS). */
function updateLineMetadataViaPsql(
  lineId: string,
  assignmentMeta: LineInfluencerAssignment
): void {
  const json = JSON.stringify(assignmentMeta);
  const tag = `meta_${lineId.replace(/-/g, "")}`;
  const sql = `
UPDATE public.campaign_lines
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{${LINE_ASSIGNMENT_META_KEY}}',
  $${tag}$${json}$${tag}$::jsonb,
  true
)
WHERE id = '${lineId}';
`;
  const tmp = resolve(`scripts/.tmp-repair-line-${lineId}.sql`);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const result = spawnSync(
      process.execPath,
      ["scripts/psql-development.mjs", "-f", tmp],
      { encoding: "utf8", cwd: resolve(".") }
    );
    if (result.status !== 0) {
      throw new Error(
        `psql metadata update failed: ${result.stderr || result.stdout || result.status}`
      );
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const dryRun = hasFlag("--dry-run") || !hasFlag("--execute");
  const campaignArg = argValue("--campaign") ?? "TW-2026-0005";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const ref = new URL(url).hostname.split(".")[0];
  if (ref !== DEV_REF) {
    throw new Error(
      `Refusing to run: connected to ${ref}, expected Development ${DEV_REF}`
    );
  }

  console.log(`Target: Development (${DEV_REF})`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "EXECUTE"}`);
  console.log(`Campaign: ${campaignArg}`);

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const looksLikeUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      campaignArg
    );

  const headerQuery = supabase
    .from("campaign_headers")
    .select("id, document_number");
  const { data: header, error: headerError } = await (
    looksLikeUuid
      ? headerQuery.eq("id", campaignArg)
      : headerQuery.eq("document_number", campaignArg)
  ).maybeSingle();

  if (headerError || !header) {
    throw new Error(headerError?.message ?? `Campaign not found: ${campaignArg}`);
  }

  const { data: lines, error: linesError } = await supabase
    .from("campaign_lines")
    .select(
      "id, name, metadata, source_quotation_item_id, revenue_before_vat, cost_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, revenue_vat_percent, revenue_vat_exempt, cost_vat_percent, cost_vat_exempt, pricing_mode, start_date, end_date"
    )
    .eq("campaign_header_id", header.id)
    .not("source_quotation_item_id", "is", null);

  if (linesError) throw new Error(linesError.message);

  const itemIds = [
    ...new Set(
      (lines ?? [])
        .map((l) => l.source_quotation_item_id as string)
        .filter(Boolean)
    ),
  ];

  const { data: items, error: itemsError } = await supabase
    .from("quotation_items")
    .select(
      "id, influencer_id, unified_id, creator_name, platform, handle, deliverables, cost, revenue, cost_currency, option_number"
    )
    .in("id", itemIds);

  if (itemsError) throw new Error(itemsError.message);

  const itemById = new Map((items ?? []).map((item) => [item.id as string, item]));
  const influencerIds = [
    ...new Set(
      (items ?? [])
        .map((item) => item.influencer_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: accounts, error: accountsError } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, audience_country"
    )
    .in("influencer_id", influencerIds);

  if (accountsError) throw new Error(accountsError.message);

  const accountsByInfluencer = new Map<string, typeof accounts>();
  for (const account of accounts ?? []) {
    const key = account.influencer_id as string;
    const list = accountsByInfluencer.get(key) ?? [];
    list.push(account);
    accountsByInfluencer.set(key, list);
  }

  let repaired = 0;
  let skipped = 0;

  for (const line of lines ?? []) {
    const item = itemById.get(line.source_quotation_item_id as string);
    if (!item?.influencer_id) {
      skipped += 1;
      console.warn(`Skip line ${line.id}: missing quotation item / influencer`);
      continue;
    }

    const influencerAccounts = accountsByInfluencer.get(item.influencer_id) ?? [];
    const creator: UnifiedCreatorResult = {
      unified_id: (item.unified_id as string) || `inf:${item.influencer_id}`,
      source_type: "influencer",
      influencer_id: item.influencer_id as string,
      discovered_profile_id: null,
      document_number: null,
      display_name: (item.creator_name as string) || "Vendor",
      status: null,
      country_code: null,
      estimated_country: null,
      city: null,
      categories: [],
      language_codes: [],
      profile_image_url: null,
      bio: null,
      metrics: {
        followers: { value: null, confidence: "estimated" },
        engagement_rate: { value: null, confidence: "estimated" },
        avg_likes: { value: null, confidence: "estimated" },
        avg_comments: { value: null, confidence: "estimated" },
        avg_views: { value: null, confidence: "estimated" },
        posting_frequency_per_week: { value: null, confidence: "estimated" },
      },
      ai_category: null,
      ai_niche: null,
      authenticity_score: null,
      thinkway_score: 0,
      source_confidence: 0,
      brand_fit_score: null,
      is_platform_verified: false,
      platforms: influencerAccounts.map((account) => ({
        id: account.id as string,
        platform: String(account.platform ?? "instagram"),
        handle: String(account.handle ?? ""),
        profile_url: (account.profile_url as string | null) ?? null,
        follower_count: (account.follower_count as number | null) ?? null,
        engagement_rate: (account.engagement_rate as number | null) ?? null,
        audience_country: (account.audience_country as string | null) ?? null,
      })),
    };

    const executionRow: QuotationItemExecutionRow = {
      id: item.id as string,
      influencer_id: item.influencer_id as string,
      unified_id: (item.unified_id as string | null) ?? null,
      creator_name: (item.creator_name as string | null) ?? null,
      platform: (item.platform as string | null) ?? null,
      handle: (item.handle as string | null) ?? null,
      deliverables: parseDeliverables(item.deliverables),
      cost: Number(item.cost ?? 0),
      revenue: Number(item.revenue ?? 0),
      cost_currency: String(item.cost_currency ?? "EGP"),
      option_number:
        item.option_number == null ? null : Number(item.option_number),
    };

    const platforms = quotationDeliverablesToPlatforms(
      executionRow.deliverables ?? [],
      creator,
      executionRow
    );

    if (platforms.length === 0) {
      skipped += 1;
      console.warn(
        `Skip ${line.name}: remapped platforms empty (missing creator accounts?)`
      );
      continue;
    }

    const before = parseLineAssignment(
      (line.metadata as Record<string, unknown> | null) ?? null
    );
    const beforeSummary = (before?.platforms ?? [])
      .map((p) => `${p.platform}:[${p.deliverables.join(",")}]`)
      .join(" | ");
    const afterSummary = platforms
      .map((p) => `${p.platform}:[${p.deliverables.join(",")}]`)
      .join(" | ");

    const changed = beforeSummary !== afterSummary;
    if (!changed) {
      console.log(`\n${line.name}: unchanged, skip`);
      continue;
    }

    console.log(`\n${line.name}`);
    console.log(`  before: ${beforeSummary || "(none)"}`);
    console.log(`  after:  ${afterSummary}`);

    if (dryRun) {
      repaired += 1;
      continue;
    }

    const existingMeta = parseLineAssignment(
      (line.metadata as Record<string, unknown> | null) ?? null
    );
    const assignmentMeta: LineInfluencerAssignment = {
      influencer_id:
        existingMeta?.influencer_id ?? (item.influencer_id as string),
      influencer_name:
        existingMeta?.influencer_name ??
        ((item.creator_name as string) || "Vendor"),
      influencer_document_number:
        existingMeta?.influencer_document_number ?? "",
      platforms,
      title_user_edited: existingMeta?.title_user_edited ?? false,
      pricing_mode: existingMeta?.pricing_mode ?? "package",
      commercial_rows: undefined,
    };

    try {
      updateLineMetadataViaPsql(line.id as string, assignmentMeta);
    } catch (error) {
      skipped += 1;
      console.warn(
        `  metadata update failed: ${error instanceof Error ? error.message : error}`
      );
      continue;
    }

    const deliverableCount = platforms.reduce(
      (sum, p) => sum + p.deliverables.length,
      0
    );
    const commercial: ResolvedLineCommercialInput = {
      pricing_mode: "package",
      platforms,
      commercial_rows: [],
      revenue_before_vat: Number(line.revenue_before_vat ?? 0),
      cost_before_vat: Number(line.cost_before_vat ?? 0),
      deliverable_count: deliverableCount,
    };

    try {
      await syncAssignmentDeliverablesForLine(supabase, {
        campaignHeaderId: header.id as string,
        campaignLineId: line.id as string,
        commercial,
        revenueBeforeVat: Number(line.revenue_before_vat ?? 0),
        costBeforeVat: Number(line.cost_before_vat ?? 0),
        usageRightsAmount: Number(line.usage_rights_amount ?? 0),
        usageRightsCost: Number(line.usage_rights_cost ?? 0),
        agencyFeePercent: Number(line.agency_fee_percent ?? 0),
        dueDate:
          (line.end_date as string | null) ??
          (line.start_date as string | null),
        revenueVatPercent: Number(line.revenue_vat_percent ?? 0),
        revenueVatExempt: Boolean(line.revenue_vat_exempt),
        costVatPercent: Number(line.cost_vat_percent ?? 0),
        costVatExempt: Boolean(line.cost_vat_exempt),
      });
    } catch (error) {
      skipped += 1;
      console.warn(
        `  deliverable sync failed: ${error instanceof Error ? error.message : error}`
      );
      continue;
    }

    repaired += 1;
  }

  console.log(
    `\nDone. ${dryRun ? "Would repair" : "Repaired"} ${repaired} line(s); skipped ${skipped}.`
  );
  if (dryRun) {
    console.log("Re-run with --execute to apply.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
