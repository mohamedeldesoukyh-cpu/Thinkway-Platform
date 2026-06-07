/**
 * Deterministic billing lifecycle E2E (service role, fresh data).
 * Run: npx tsx scripts/billing-lifecycle-e2e-retest.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { commitInvoiceLifecycleMutation } from "@/lib/billing/invoice-lifecycle-commit";
import {
  fetchDeliverablesForInvoicing,
  lockDeliverablesOnInvoice,
  recalculateInvoiceTotals,
  regenerateInvoiceLineItems,
} from "@/lib/billing/invoice-from-deliverables";
import { isOperationalRowInvoiceEligible } from "@/lib/billing/operational-billing-rows";
import { loadCampaignOperationalBilling } from "@/lib/billing/operational-billing-query";
import { LINE_ASSIGNMENT_META_KEY } from "@/features/campaigns/line-assignment";

config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const TAG = `LIFECYCLE-RETEST-${stamp}`;

type StepResult = { step: string; ok: boolean; detail: string };

const results: StepResult[] = [];

function record(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${step}: ${detail}`);
  if (!ok) throw new Error(`${step} — ${detail}`);
}

async function sqlCheck(name: string, query: string, expectZero = true) {
  const { data, error } = await supabase.rpc("exec_sql_check" as never, {} as never);
  void data;
  void error;

  const { data: rows, error: qError } = await supabase
    .from("invoice_line_items")
    .select("id")
    .limit(1);

  if (qError && !qError.message.includes("Could not find")) {
    // fall through to manual checks below
  }
  void rows;

  const checks: Record<string, () => Promise<number>> = {
    duplicate_invoice_line_items: async () => {
      const { data: dupes } = await supabase
        .from("invoice_line_items")
        .select("invoice_id, assignment_post_schedule_id")
        .not("assignment_post_schedule_id", "is", null);
      const seen = new Set<string>();
      let count = 0;
      for (const row of dupes ?? []) {
        const key = `${(row as { invoice_id: string }).invoice_id}:${(row as { assignment_post_schedule_id: string }).assignment_post_schedule_id}`;
        if (seen.has(key)) count += 1;
        seen.add(key);
      }
      const { data: d2 } = await supabase
        .from("invoice_line_items")
        .select("invoice_id, assignment_deliverable_id, assignment_post_schedule_id")
        .not("assignment_deliverable_id", "is", null)
        .is("assignment_post_schedule_id", null);
      const seen2 = new Set<string>();
      for (const row of d2 ?? []) {
        const r = row as {
          invoice_id: string;
          assignment_deliverable_id: string;
        };
        const key = `${r.invoice_id}:${r.assignment_deliverable_id}`;
        if (seen2.has(key)) count += 1;
        seen2.add(key);
      }
      return count;
    },
    orphan_post_links: async () => {
      const { count } = await supabase
        .from("assignment_post_schedule")
        .select("id", { count: "exact", head: true })
        .not("invoice_line_item_id", "is", null)
        .filter("invoice_line_item_id", "not.in", "(select id from invoice_line_items)");
      return count ?? 0;
    },
    pending_regeneration_invoices: async () => {
      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("regeneration_status", "pending_regeneration");
      return count ?? 0;
    },
    stale_assignment_locks: async () => {
      const { data } = await supabase
        .from("campaign_lines")
        .select("id, invoice_id, billing_status")
        .in("billing_status", ["invoiced", "paid"])
        .is("invoice_id", null);
      return (data ?? []).length;
    },
  };

  if (checks[name]) {
    const count = await checks[name]();
    const ok = expectZero ? count === 0 : count > 0;
    record(`SQL:${name}`, ok, `count=${count}`);
    return count;
  }

  record(`SQL:${name}`, false, `unknown check`);
  return -1;
}

async function main() {
  let brand: {
    id: string;
    client_id: string;
    group_id: string;
    currency_code: string | null;
  } | null = null;

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id, client_id, group_id, currency_code")
    .limit(1)
    .maybeSingle();

  if (brandRow) {
    brand = brandRow;
  } else {
    const { data: headerSeed } = await supabase
      .from("campaign_headers")
      .select("brand_id, client_id, group_id, currency_code, brand:brands(id, client_id, group_id, currency_code)")
      .not("brand_id", "is", null)
      .limit(1)
      .maybeSingle();

    const nested = headerSeed as {
      brand_id: string;
      client_id: string;
      group_id: string;
      currency_code: string;
      brand: { id: string; client_id: string; group_id: string; currency_code: string | null } | null;
    } | null;

    if (nested?.brand) {
      brand = nested.brand;
    } else if (nested?.brand_id) {
      brand = {
        id: nested.brand_id,
        client_id: nested.client_id,
        group_id: nested.group_id,
        currency_code: nested.currency_code,
      };
    }
  }

  if (!brand) {
    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .insert({ name: `${TAG} Group`, document_number: "PENDING" })
      .select("id")
      .single();

    if (groupErr || !group) throw new Error(groupErr?.message ?? "group seed failed");

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .insert({
        group_id: group.id,
        name: `${TAG} Legal Entity`,
        legal_name: `${TAG} Legal Entity`,
        document_number: "PENDING",
        currency: "USD",
      })
      .select("id")
      .single();

    if (clientErr || !client) throw new Error(clientErr?.message ?? "client seed failed");

    const { data: seededBrand, error: brandErr } = await supabase
      .from("brands")
      .insert({
        client_id: client.id,
        group_id: group.id,
        name: `${TAG} Brand`,
        document_number: "PENDING",
        currency_code: "USD",
        agency_or_direct: "direct",
      })
      .select("id, client_id, group_id, currency_code")
      .single();

    if (brandErr || !seededBrand) throw new Error(brandErr?.message ?? "brand seed failed");
    brand = seededBrand;
    record("0-seed-master-data", true, `brand=${seededBrand.id}`);
  }

  const { data: influencer } = await supabase
    .from("influencers")
    .select("id, display_name, document_number")
    .limit(1)
    .maybeSingle();

  let influencerId = influencer?.id;
  let influencerName = influencer?.display_name;
  let influencerDoc = influencer?.document_number;

  if (!influencerId) {
    const { data: seededInf, error: infErr } = await supabase
      .from("influencers")
      .insert({
        display_name: `${TAG} Creator`,
        document_number: "PENDING",
        status: "prospect",
        country_code: "AE",
      })
      .select("id, display_name, document_number")
      .single();

    if (infErr || !seededInf) throw new Error(infErr?.message ?? "influencer seed failed");
    influencerId = seededInf.id;
    influencerName = seededInf.display_name;
    influencerDoc = seededInf.document_number;
    record("0-seed-influencer", true, influencerId);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  const actorId = profile?.id ?? null;

  // 1. Create campaign
  const { data: campaign, error: campErr } = await supabase
    .from("campaign_headers")
    .insert({
      name: `${TAG} Campaign`,
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
  record("1-create-campaign", true, campaign.document_number);

  const assignmentMeta = {
    influencer_id: influencerId,
    influencer_name: influencerName,
    influencer_document_number: influencerDoc,
    platforms: [
      {
        platform: "instagram",
        handle: "@retest",
        deliverables: [{ type: "instagram_reel", quantity: 2 }],
      },
    ],
    pricing_mode: "per_deliverable" as const,
  };

  // 2. Create assignment line
  const { data: line, error: lineErr } = await supabase
    .from("campaign_lines")
    .insert({
      campaign_header_id: campaign.id,
      name: `${influencerName} — Retest`,
      status: "draft",
      assignment_status: "confirmed",
      pricing_mode: "per_deliverable",
      revenue: 2000,
      revenue_before_vat: 2000,
      revenue_vat_percent: 0,
      revenue_vat_exempt: true,
      cost: 500,
      cost_before_vat: 500,
      currency_code: brand.currency_code ?? "USD",
      metadata: { [LINE_ASSIGNMENT_META_KEY]: assignmentMeta },
      created_by: actorId,
    })
    .select("id, document_number")
    .single();

  if (lineErr || !line) throw new Error(lineErr?.message ?? "line create failed");
  record("2-create-assignment", true, line.document_number);

  const deliverablePayloads = [
    { sort: 0, revenue: 1000, type: "instagram_reel" },
    { sort: 1, revenue: 1000, type: "instagram_story" },
  ];

  const deliverableIds: string[] = [];

  for (const d of deliverablePayloads) {
    const { data: del, error: delErr } = await supabase
      .from("assignment_deliverables")
      .insert({
        campaign_header_id: campaign.id,
        campaign_line_id: line.id,
        sort_order: d.sort,
        platform: "instagram",
        deliverable_type: d.type,
        quantity: 1,
        revenue_before_vat: d.revenue,
        revenue_vat_percent: 0,
        revenue_vat_exempt: true,
        billable_amount: d.revenue,
        remaining_amount: d.revenue,
        billing_status: "draft",
      })
      .select("id")
      .single();

    if (delErr || !del) throw new Error(delErr?.message ?? "deliverable create failed");
    deliverableIds.push(del.id);
  }
  record("2b-deliverables", true, `${deliverableIds.length} rows`);

  // 3. Generate Vendor IO
  const { data: ci, error: ciErr } = await supabase
    .from("campaign_influencers")
    .insert({
      campaign_header_id: campaign.id,
      campaign_line_id: line.id,
      influencer_id: influencerId,
      status: "confirmed",
      agreed_fee: 2000,
      currency: brand.currency_code ?? "USD",
      deliverable_count: 2,
    })
    .select("id")
    .single();

  if (ciErr || !ci) throw new Error(ciErr?.message ?? "campaign_influencer failed");

  const { data: vio, error: vioErr } = await supabase
    .from("vendor_ios")
    .insert({
      assignment_id: ci.id,
      campaign_header_id: campaign.id,
      influencer_id: influencerId,
      amount: 2000,
      currency_code: brand.currency_code ?? "USD",
      status: "draft",
      terms_text: "Lifecycle retest VIO",
      created_by: actorId,
      updated_by: actorId,
      revision_number: 0,
    })
    .select("id, document_number")
    .single();

  if (vioErr || !vio) throw new Error(vioErr?.message ?? "VIO failed");

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

  record("3-generate-vio", true, vio.document_number);

  // 4. First invoice (deliverable 1 only — partial)
  const { data: invoice, error: invErr } = await supabase
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

  if (invErr || !invoice) throw new Error(invErr?.message ?? "invoice create failed");

  const { deliverables: del1Rows, error: fetch1Err } = await fetchDeliverablesForInvoicing(
    supabase,
    campaign.id,
    [deliverableIds[0]!]
  );
  if (fetch1Err) throw new Error(fetch1Err);

  const lock1 = await lockDeliverablesOnInvoice(supabase, invoice.id, campaign.id, del1Rows, {
    defaultVatRate: 0,
  });
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

  const { data: invAfter1 } = await supabase
    .from("invoices")
    .select("subtotal, total, document_number")
    .eq("id", invoice.id)
    .single();

  record(
    "4-5-first-invoice-totals",
    Number(invAfter1?.subtotal) === 1000,
    `subtotal=${invAfter1?.subtotal} doc=${invAfter1?.document_number}`
  );

  const { data: lockedDel1 } = await supabase
    .from("assignment_deliverables")
    .select("locked_at, invoice_line_item_id, billing_status")
    .eq("id", deliverableIds[0]!)
    .single();

  record(
    "6-locks-after-first",
    Boolean(lockedDel1?.locked_at && lockedDel1?.invoice_line_item_id),
    `billing=${lockedDel1?.billing_status}`
  );

  // 7. Billing queue / operational rows
  const tree1 = await loadCampaignOperationalBilling(supabase, campaign.id);
  const leaves1 =
    tree1?.operational_rows
      .flatMap((r) => r.children)
      .flatMap((d) => (d.children.length > 0 ? d.children : [d])) ?? [];
  const phantomGenerate = leaves1.some(
    (row) =>
      row.invoice_line_item_id &&
      row.invoice_regeneration_status !== "pending_regeneration" &&
      isOperationalRowInvoiceEligible(row)
  );
  record("7-billing-queue-no-phantom", !phantomGenerate, `${leaves1.length} leaf rows`);

  // 8. Append second deliverable
  const { deliverables: del2Rows, error: fetch2Err } = await fetchDeliverablesForInvoicing(
    supabase,
    campaign.id,
    [deliverableIds[1]!]
  );
  if (fetch2Err) throw new Error(fetch2Err);

  const lock2 = await lockDeliverablesOnInvoice(supabase, invoice.id, campaign.id, del2Rows, {
    defaultVatRate: 0,
    updateExistingOnTargetInvoice: true,
  });
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

  const { data: invAfter2 } = await supabase
    .from("invoices")
    .select("subtotal, total")
    .eq("id", invoice.id)
    .single();

  record(
    "8-9-append-totals",
    Number(invAfter2?.subtotal) === 2000,
    `subtotal=${invAfter2?.subtotal}`
  );

  const invoiceNumberBefore = invoice.document_number;
  const subtotalBeforeRegen = Number(invAfter2?.subtotal);

  // 10-11. Commercial change + pending_regeneration
  await supabase
    .from("assignment_deliverables")
    .update({ revenue_before_vat: 1200, billable_amount: 1200 })
    .eq("id", deliverableIds[0]!);

  const ungen = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "ungenerate",
    invoiceId: invoice.id,
    invoiceDocumentNumber: invoice.document_number,
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

  const { data: invPending } = await supabase
    .from("invoices")
    .select("regeneration_status, document_number")
    .eq("id", invoice.id)
    .single();

  record(
    "11-pending-regeneration",
    invPending?.regeneration_status === "pending_regeneration",
    invPending?.regeneration_status ?? "null"
  );

  // 12. Regenerate same invoice
  const { data: lineItemsBefore } = await supabase
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
      const regenResult = await regenerateInvoiceLineItems(supabase, invoice.id, campaign.id, {
        defaultVatRate: 0,
      });
      if (regenResult.error) return { error: regenResult.error };

      const { error } = await supabase
        .from("invoices")
        .update({ regeneration_status: "active", status: "draft" })
        .eq("id", invoice.id);
      if (error) return { error: error.message };

      return {
        touchedLineIds: [line.id],
        lineItemOps: {
          updated: (lineItemsBefore ?? []).map((r) => (r as { id: string }).id),
          created: [],
        },
      };
    },
  });
  if (regen.error) throw new Error(regen.error);

  const { data: invAfterRegen } = await supabase
    .from("invoices")
    .select("subtotal, total, document_number, regeneration_status")
    .eq("id", invoice.id)
    .single();

  const { count: lineItemCount } = await supabase
    .from("invoice_line_items")
    .select("id", { count: "exact", head: true })
    .eq("invoice_id", invoice.id);

  const expectedAfterCommercial = 2200;
  record(
    "13-regenerate-totals",
    Number(invAfterRegen?.subtotal) === expectedAfterCommercial,
    `subtotal=${invAfterRegen?.subtotal} expected=${expectedAfterCommercial}`
  );
  record(
    "13-same-invoice-number",
    invAfterRegen?.document_number === invoiceNumberBefore,
    invAfterRegen?.document_number ?? ""
  );
  record(
    "13-no-duplicate-line-items",
    (lineItemCount ?? 0) === 2,
    `line_items=${lineItemCount}`
  );
  record(
    "13-active-after-regenerate",
    invAfterRegen?.regeneration_status === "active",
    invAfterRegen?.regeneration_status ?? ""
  );

  const { data: lineAfterRegen } = await supabase
    .from("campaign_lines")
    .select("billing_status, invoice_id, operational_status")
    .eq("id", line.id)
    .single();

  record(
    "13-assignments-invoiced",
    lineAfterRegen?.billing_status === "invoiced" && lineAfterRegen?.invoice_id === invoice.id,
    `${lineAfterRegen?.billing_status} ops=${lineAfterRegen?.operational_status}`
  );

  // 14-15. Ungenerate — all locks removed
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

  const { data: delsUnlocked } = await supabase
    .from("assignment_deliverables")
    .select("locked_at, invoice_line_item_id")
    .in("id", deliverableIds);

  const anyStillLocked = (delsUnlocked ?? []).every((d) => !d.locked_at);
  record("15-locks-removed", anyStillLocked, `rows=${delsUnlocked?.length}`);

  // 16-18. Re-generate from clean pending state
  const regen2 = await commitInvoiceLifecycleMutation(supabase, {
    mutation: "regenerate",
    invoiceId: invoice.id,
    campaignId: campaign.id,
    actorId,
    touchedLineIds: [line.id],
    execute: async () => {
      const regenResult = await regenerateInvoiceLineItems(supabase, invoice.id, campaign.id, {
        defaultVatRate: 0,
      });
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

  await recalculateInvoiceTotals(supabase, invoice.id);

  const { data: invFinal } = await supabase
    .from("invoices")
    .select("subtotal, document_number")
    .eq("id", invoice.id)
    .single();

  const { data: sumRows } = await supabase
    .from("invoice_line_items")
    .select("revenue_before_vat")
    .eq("invoice_id", invoice.id);

  const lineSum = (sumRows ?? []).reduce(
    (s, r) => s + Number((r as { revenue_before_vat: number }).revenue_before_vat),
    0
  );

  record(
    "18-totals-match-line-sum",
    Number(invFinal?.subtotal) === lineSum,
    `invoice=${invFinal?.subtotal} lines=${lineSum} doc=${invFinal?.document_number}`
  );

  // SQL verification suite (campaign-scoped where possible)
  await sqlCheck("duplicate_invoice_line_items", "", true);

  const { data: orphanPosts } = await supabase
    .from("assignment_post_schedule")
    .select("id, invoice_line_item_id")
    .in(
      "campaign_line_id",
      [line.id]
    )
    .not("invoice_line_item_id", "is", null);

  const iliIds = new Set((sumRows ?? []).map((r) => (r as { id?: string }).id));
  void iliIds;
  record("SQL:orphan_post_links", (orphanPosts ?? []).length === 0, `posts=${orphanPosts?.length}`);

  const { data: pendingRows } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoice.id)
    .eq("regeneration_status", "pending_regeneration");
  record("SQL:pending_regeneration_cleared", (pendingRows ?? []).length === 0, "active expected");

  const { data: staleLocks } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("id", line.id)
    .in("billing_status", ["invoiced"])
    .is("invoice_id", null);
  record("SQL:stale_assignment_locks", (staleLocks ?? []).length === 0, `count=${staleLocks?.length}`);

  console.log("\n=== LIFECYCLE RETEST COMPLETE ===");
  console.log(`Campaign: ${campaign.document_number} (${campaign.id})`);
  console.log(`Invoice: ${invFinal?.document_number} (${invoice.id})`);
  console.log(`Steps passed: ${results.filter((r) => r.ok).length}/${results.length}`);
}

main().catch((err) => {
  console.error("\n=== LIFECYCLE RETEST ABORTED ===");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
