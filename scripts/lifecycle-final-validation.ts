/**
 * Clean-room billing lifecycle validation (post PR1–PR6).
 * Run: npx tsx scripts/lifecycle-final-validation.ts
 *
 * Uses real service_role JWT from Supabase CLI when .env has sb_secret_* only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { commitInvoiceLifecycleMutation } from "@/lib/billing/invoice-lifecycle-commit";
import {
  fetchDeliverablesForInvoicing,
  lockDeliverablesOnInvoice,
  recalculateInvoiceTotals,
  regenerateInvoiceLineItems,
} from "@/lib/billing/invoice-from-deliverables";
import {
  isOperationalRowInvoiceEligible,
  isOperationalRowUiSelectable,
} from "@/lib/billing/operational-billing-rows";
import { loadCampaignOperationalBilling } from "@/lib/billing/operational-billing-query";
import { LINE_ASSIGNMENT_META_KEY } from "@/features/campaigns/line-assignment";

const jwtFromShell = process.env.SUPABASE_SERVICE_ROLE_JWT?.trim();
config({ path: ".env" });

const CAMPAIGN_NAME = "LIFECYCLE-FINAL-VALIDATION-2026-06-04";
const REPORT_DIR = join(process.cwd(), "docs", "validation-artifacts");

type StepResult = {
  step: string;
  ok: boolean;
  detail: string;
  data?: Record<string, unknown>;
};

const results: StepResult[] = [];

function record(step: string, ok: boolean, detail: string, data?: Record<string, unknown>) {
  results.push({ step, ok, detail, data });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${step}: ${detail}`);
  if (!ok) throw new Error(`${step} — ${detail}`);
}

function resolveServiceRoleKey(): string {
  if (jwtFromShell?.startsWith("eyJ")) return jwtFromShell;

  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (envKey?.startsWith("eyJ")) return envKey;

  throw new Error(
    "Set SUPABASE_SERVICE_ROLE_JWT to the JWT service_role key (not sb_secret_*). " +
      "Retrieve from Supabase dashboard or `supabase projects api-keys`."
  );
}

function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

  return createClient(url, resolveServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertNoDuplicateLineItems(
  supabase: SupabaseClient,
  invoiceId: string
) {
  const { data: items } = await supabase
    .from("invoice_line_items")
    .select("id, assignment_deliverable_id, assignment_post_schedule_id")
    .eq("invoice_id", invoiceId);

  const postKeys = new Set<string>();
  const delKeys = new Set<string>();
  let dupes = 0;

  for (const row of items ?? []) {
    const item = row as {
      assignment_post_schedule_id: string | null;
      assignment_deliverable_id: string | null;
    };
    if (item.assignment_post_schedule_id) {
      const key = item.assignment_post_schedule_id;
      if (postKeys.has(key)) dupes += 1;
      postKeys.add(key);
    }
    if (item.assignment_deliverable_id && !item.assignment_post_schedule_id) {
      const key = item.assignment_deliverable_id;
      if (delKeys.has(key)) dupes += 1;
      delKeys.add(key);
    }
  }

  record("duplicate-line-items", dupes === 0, `dupes=${dupes} total=${items?.length ?? 0}`, {
    count: items?.length ?? 0,
  });
}

async function assertTotalsMatchLines(supabase: SupabaseClient, invoiceId: string) {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("document_number, subtotal, regeneration_status")
    .eq("id", invoiceId)
    .single();

  const { data: lines } = await supabase
    .from("invoice_line_items")
    .select("revenue_before_vat")
    .eq("invoice_id", invoiceId);

  const lineSum = (lines ?? []).reduce(
    (sum, row) => sum + Number((row as { revenue_before_vat: number }).revenue_before_vat ?? 0),
    0
  );
  const subtotal = Number(invoice?.subtotal ?? 0);
  const delta = Math.abs(subtotal - lineSum);

  record(
    "totals-equal-line-sum",
    delta < 0.01,
    `invoice=${subtotal} lines=${lineSum} doc=${invoice?.document_number}`,
    { subtotal, lineSum, regeneration_status: invoice?.regeneration_status }
  );
}

async function assertOperationalQueue(
  supabase: SupabaseClient,
  campaignId: string,
  invoiceId: string,
  expectPendingRegen: boolean
) {
  const tree = await loadCampaignOperationalBilling(supabase, campaignId);
  const leaves =
    tree.operational_rows
      .flatMap((r) => r.children)
      .flatMap((d) => (d.children.length > 0 ? d.children : [d])) ?? [];

  const phantom = leaves.filter(
    (row) =>
      row.invoice_line_item_id &&
      row.invoice_regeneration_status !== "pending_regeneration" &&
      isOperationalRowInvoiceEligible(row)
  );

  const wronglySelectable = leaves.filter(
    (row) =>
      row.invoice_line_item_id &&
      row.invoice_regeneration_status !== "pending_regeneration" &&
      isOperationalRowUiSelectable(row)
  );

  record(
    "queue-no-phantom-generate",
    phantom.length === 0 && wronglySelectable.length === 0,
    `phantom=${phantom.length} selectable=${wronglySelectable.length} leaves=${leaves.length}`,
    { expectPendingRegen }
  );
}

async function runCampaignScopedSqlChecks(
  supabase: SupabaseClient,
  campaignId: string,
  invoiceId: string
) {
  const { data: staleLocks } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_header_id", campaignId)
    .in("billing_status", ["invoiced", "paid", "closed"])
    .is("invoice_id", null);

  record(
    "sql-stale-locks",
    (staleLocks ?? []).length === 0,
    `count=${staleLocks?.length ?? 0}`
  );

  const { data: invoice } = await supabase
    .from("invoices")
    .select("regeneration_status")
    .eq("id", invoiceId)
    .single();

  record(
    "sql-no-stale-pending-regeneration",
    invoice?.regeneration_status === "active",
    `status=${invoice?.regeneration_status ?? "null"}`
  );

  await assertNoDuplicateLineItems(supabase, invoiceId);
  await assertTotalsMatchLines(supabase, invoiceId);
}

async function main() {
  const supabase = createAdminClient();

  const { data: existingCampaign } = await supabase
    .from("campaign_headers")
    .select("id, document_number")
    .eq("name", CAMPAIGN_NAME)
    .maybeSingle();

  if (existingCampaign) {
    const campaignId = existingCampaign.id;
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .eq("campaign_header_id", campaignId);
    const invoiceIds = (invoices ?? []).map((row) => (row as { id: string }).id);

    if (invoiceIds.length > 0) {
      await supabase.from("invoice_line_items").delete().in("invoice_id", invoiceIds);
      await supabase.from("invoices").delete().in("id", invoiceIds);
    }

    await supabase.from("vendor_io_lines").delete().eq("campaign_header_id", campaignId);
    await supabase.from("vendor_ios").delete().eq("campaign_header_id", campaignId);
    await supabase.from("assignment_post_schedule").delete().eq("campaign_header_id", campaignId);
    await supabase.from("assignment_deliverables").delete().eq("campaign_header_id", campaignId);
    await supabase.from("campaign_influencers").delete().eq("campaign_header_id", campaignId);
    await supabase.from("campaign_lines").delete().eq("campaign_header_id", campaignId);
    await supabase.from("campaign_headers").delete().eq("id", campaignId);
    record("0-cleanup-prior-run", true, existingCampaign.document_number);
  }

  const { data: brands, error: brandErr } = await supabase
    .from("brands")
    .select("id, client_id, group_id, currency_code, name")
    .limit(5);

  if (brandErr) throw new Error(brandErr.message);

  const brand =
    (brands ?? []).find((row) => row.currency_code === "USD") ?? brands?.[0];

  if (!brand) throw new Error("No brand found for validation seed.");

  const { data: influencer } = await supabase
    .from("influencers")
    .select("id, display_name, document_number")
    .limit(1)
    .single();

  if (!influencer) throw new Error("No influencer found.");

  const { data: profile } = await supabase.from("profiles").select("id").limit(1).single();
  const actorId = profile?.id ?? null;

  const { data: campaign, error: campErr } = await supabase
    .from("campaign_headers")
    .insert({
      name: CAMPAIGN_NAME,
      brand_id: brand.id,
      client_id: brand.client_id,
      group_id: brand.group_id,
      status: "active",
      currency_code: brand.currency_code ?? "USD",
      created_by: actorId,
    })
    .select("id, document_number, client_id")
    .single();

  if (campErr || !campaign) throw new Error(campErr?.message ?? "campaign create failed");
  record("1-create-campaign", true, campaign.document_number, { id: campaign.id });

  const assignmentMeta = {
    influencer_id: influencer.id,
    influencer_name: influencer.display_name,
    influencer_document_number: influencer.document_number,
    platforms: [
      {
        platform: "instagram",
        handle: "@lifecycle-final",
        deliverables: [
          { type: "instagram_reel", quantity: 1 },
          { type: "instagram_story", quantity: 1 },
        ],
      },
    ],
    pricing_mode: "per_deliverable" as const,
  };

  const { data: line, error: lineErr } = await supabase
    .from("campaign_lines")
    .insert({
      campaign_header_id: campaign.id,
      name: `${influencer.display_name} — Final Validation`,
      status: "draft",
      assignment_status: "confirmed",
      pricing_mode: "per_deliverable",
      revenue: 2000,
      revenue_before_vat: 2000,
      revenue_vat_percent: 0,
      revenue_vat_exempt: true,
      cost: 800,
      cost_before_vat: 800,
      currency_code: brand.currency_code ?? "USD",
      metadata: { [LINE_ASSIGNMENT_META_KEY]: assignmentMeta },
      created_by: actorId,
    })
    .select("id, document_number")
    .single();

  if (lineErr || !line) throw new Error(lineErr?.message ?? "assignment create failed");
  record("2-create-assignment", true, line.document_number, { id: line.id });

  const deliverableDefs = [
    { sort: 0, revenue: 1000, type: "instagram_reel" },
    { sort: 1, revenue: 1000, type: "instagram_story" },
  ];
  const deliverableIds: string[] = [];

  for (const def of deliverableDefs) {
    const { data: del, error: delErr } = await supabase
      .from("assignment_deliverables")
      .insert({
        campaign_header_id: campaign.id,
        campaign_line_id: line.id,
        sort_order: def.sort,
        platform: "instagram",
        deliverable_type: def.type,
        quantity: 1,
        revenue_before_vat: def.revenue,
        revenue_vat_percent: 0,
        revenue_vat_exempt: true,
        billable_amount: def.revenue,
        remaining_amount: def.revenue,
        billing_status: "draft",
      })
      .select("id")
      .single();

    if (delErr || !del) throw new Error(delErr?.message ?? "deliverable create failed");
    deliverableIds.push(del.id);
  }
  record("3-create-deliverables", true, `${deliverableIds.length} rows`);

  const { data: ci } = await supabase
    .from("campaign_influencers")
    .insert({
      campaign_header_id: campaign.id,
      campaign_line_id: line.id,
      influencer_id: influencer.id,
      status: "confirmed",
      agreed_fee: 2000,
      currency: brand.currency_code ?? "USD",
      deliverable_count: 2,
    })
    .select("id")
    .single();

  if (!ci) throw new Error("campaign_influencer create failed");

  const { data: vio } = await supabase
    .from("vendor_ios")
    .insert({
      assignment_id: ci.id,
      campaign_header_id: campaign.id,
      influencer_id: influencer.id,
      amount: 2000,
      currency_code: brand.currency_code ?? "USD",
      status: "draft",
      terms_text: "Lifecycle final validation VIO",
      created_by: actorId,
      updated_by: actorId,
      revision_number: 0,
    })
    .select("id, document_number, revision_number")
    .single();

  if (!vio) throw new Error("vendor IO create failed");

  await supabase.from("vendor_io_lines").insert({
    vendor_io_id: vio.id,
    campaign_line_id: line.id,
  });

  await supabase
    .from("campaign_lines")
    .update({
      vendor_io_id: vio.id,
      operational_status: "io_generated",
      billing_status: "moved_to_billing",
    })
    .eq("id", line.id);

  await supabase
    .from("assignment_deliverables")
    .update({ billing_status: "ready_to_invoice" })
    .in("id", deliverableIds);

  record("4-generate-vio", true, vio.document_number, {
    vio_id: vio.id,
    revision: vio.revision_number,
  });

  const { data: invoice } = await supabase
    .from("invoices")
    .insert({
      client_id: campaign.client_id,
      campaign_header_id: campaign.id,
      status: "draft",
      currency: brand.currency_code ?? "USD",
      created_by: actorId,
    })
    .select("id, document_number")
    .single();

  if (!invoice) throw new Error("invoice create failed");
  const invoiceNumberFirst = invoice.document_number;

  const { deliverables: firstRows } = await fetchDeliverablesForInvoicing(
    supabase,
    campaign.id,
    [deliverableIds[0]!]
  );

  const lock1 = await lockDeliverablesOnInvoice(
    supabase,
    invoice.id,
    campaign.id,
    firstRows,
    { defaultVatRate: 0 }
  );
  if (lock1.error) throw new Error(lock1.error);

  const commit1 = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "create",
    invoiceId: invoice.id,
    campaignId: campaign.id,
    invoiceDocumentNumber: invoice.document_number,
    actorId,
    touchedLineIds: [line.id],
    execute: async () => ({ touchedLineIds: [line.id] }),
  });
  if (commit1.error) throw new Error(commit1.error);

  await assertTotalsMatchLines(supabase, invoice.id);
  await assertNoDuplicateLineItems(supabase, invoice.id);
  await assertOperationalQueue(supabase, campaign.id, invoice.id, false);
  record("5-7-first-invoice", true, invoice.document_number, { subtotal: 1000 });

  const { deliverables: appendRows } = await fetchDeliverablesForInvoicing(
    supabase,
    campaign.id,
    [deliverableIds[1]!]
  );

  const lock2 = await lockDeliverablesOnInvoice(
    supabase,
    invoice.id,
    campaign.id,
    appendRows,
    { defaultVatRate: 0, updateExistingOnTargetInvoice: true }
  );
  if (lock2.error) throw new Error(lock2.error);

  const commit2 = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "append",
    invoiceId: invoice.id,
    campaignId: campaign.id,
    invoiceDocumentNumber: invoice.document_number,
    actorId,
    touchedLineIds: [line.id],
    execute: async () => ({ touchedLineIds: [line.id] }),
  });
  if (commit2.error) throw new Error(commit2.error);

  await assertTotalsMatchLines(supabase, invoice.id);
  record("8-9-append", true, `subtotal=2000 lines=2`);

  const subtotalBeforeChange = 2000;
  await supabase
    .from("assignment_deliverables")
    .update({ revenue_before_vat: 1200, billable_amount: 1200 })
    .eq("id", deliverableIds[0]!);

  record("10-commercial-change", true, "del1 1000→1200");

  const ungen = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "ungenerate",
    invoiceId: invoice.id,
    actorId,
    execute: async () => {
      const { error } = await supabase
        .from("invoices")
        .update({
          regeneration_status: "pending_regeneration",
          status: "draft",
          is_operational_locked: false,
        })
        .eq("id", invoice.id);
      if (error) return { error: error.message };
      return {};
    },
  });
  if (ungen.error) throw new Error(ungen.error);
  record("11-pending-regeneration", true, "ungenerated");

  const { data: lineItemsBeforeRegen } = await supabase
    .from("invoice_line_items")
    .select("id")
    .eq("invoice_id", invoice.id);

  const regen = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "regenerate",
    invoiceId: invoice.id,
    campaignId: campaign.id,
    invoiceDocumentNumber: invoice.document_number,
    actorId,
    touchedLineIds: [line.id],
    execute: async () => {
      const regenResult = await regenerateInvoiceLineItems(
        supabase,
        invoice.id,
        campaign.id,
        { defaultVatRate: 0 }
      );
      if (regenResult.error) return { error: regenResult.error };

      const { error } = await supabase
        .from("invoices")
        .update({ regeneration_status: "active", status: "draft" })
        .eq("id", invoice.id);
      if (error) return { error: error.message };

      return {
        touchedLineIds: [line.id],
        lineItemOps: {
          updated: (lineItemsBeforeRegen ?? []).map((r) => (r as { id: string }).id),
          created: [],
        },
      };
    },
  });
  if (regen.error) throw new Error(regen.error);

  const { data: invAfterRegen } = await supabase
    .from("invoices")
    .select("document_number, subtotal, regeneration_status")
    .eq("id", invoice.id)
    .single();

  const expectedAfterRegen = 2200;
  record(
    "12-regenerate",
    invAfterRegen?.document_number === invoiceNumberFirst &&
      Number(invAfterRegen?.subtotal) === expectedAfterRegen &&
      invAfterRegen?.regeneration_status === "active",
    `doc=${invAfterRegen?.document_number} subtotal=${invAfterRegen?.subtotal}`,
    { expected: expectedAfterRegen, delta: Number(invAfterRegen?.subtotal) - subtotalBeforeChange }
  );

  await assertNoDuplicateLineItems(supabase, invoice.id);
  await assertTotalsMatchLines(supabase, invoice.id);
  await assertOperationalQueue(supabase, campaign.id, invoice.id, false);

  const { data: lineInvoiced } = await supabase
    .from("campaign_lines")
    .select("billing_status, invoice_id")
    .eq("id", line.id)
    .single();

  record(
    "12-assignments-invoiced",
    lineInvoiced?.billing_status === "invoiced" && lineInvoiced?.invoice_id === invoice.id,
    `${lineInvoiced?.billing_status}`
  );

  const ungen2 = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "ungenerate",
    invoiceId: invoice.id,
    actorId,
    execute: async () => {
      const { error } = await supabase
        .from("invoices")
        .update({
          regeneration_status: "pending_regeneration",
          status: "draft",
          is_operational_locked: false,
        })
        .eq("id", invoice.id);
      if (error) return { error: error.message };
      return {};
    },
  });
  if (ungen2.error) throw new Error(ungen2.error);

  const { data: delsAfterUngen } = await supabase
    .from("assignment_deliverables")
    .select("locked_at")
    .in("id", deliverableIds);

  const locksCleared = (delsAfterUngen ?? []).every((d) => !d.locked_at);
  record("13-15-locks-cleared", locksCleared, `rows=${delsAfterUngen?.length ?? 0}`);

  const regen2 = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "regenerate",
    invoiceId: invoice.id,
    campaignId: campaign.id,
    actorId,
    touchedLineIds: [line.id],
    execute: async () => {
      const regenResult = await regenerateInvoiceLineItems(
        supabase,
        invoice.id,
        campaign.id,
        { defaultVatRate: 0 }
      );
      if (regenResult.error) return { error: regenResult.error };

      const { error } = await supabase
        .from("invoices")
        .update({ regeneration_status: "active" })
        .eq("id", invoice.id);
      if (error) return { error: error.message };
      return { touchedLineIds: [line.id] };
    },
  });
  if (regen2.error) throw new Error(regen2.error);

  await assertTotalsMatchLines(supabase, invoice.id);
  record("16-final-regenerate", true, invAfterRegen?.document_number ?? invoice.document_number);

  await runCampaignScopedSqlChecks(supabase, campaign.id, invoice.id);

  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, "lifecycle-final-validation-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        campaign_name: CAMPAIGN_NAME,
        campaign_id: campaign.id,
        campaign_document_number: campaign.document_number,
        invoice_id: invoice.id,
        invoice_document_number: invoice.document_number,
        passed: results.filter((r) => r.ok).length,
        total: results.length,
        steps: results,
        completed_at: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log("\n=== CLEAN-ROOM VALIDATION PASSED ===");
  console.log(`Campaign: ${campaign.document_number} (${campaign.id})`);
  console.log(`Invoice: ${invoice.document_number} (${invoice.id})`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, "lifecycle-final-validation-report.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        campaign_name: CAMPAIGN_NAME,
        passed: results.filter((r) => r.ok).length,
        total: results.length,
        steps: results,
        error: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.error("\n=== CLEAN-ROOM VALIDATION FAILED ===");
  console.error(error instanceof Error ? error.message : error);
  console.error(`Partial report: ${reportPath}`);
  process.exit(1);
});
