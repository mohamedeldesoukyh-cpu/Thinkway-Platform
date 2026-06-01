"use server";

import { revalidatePath } from "next/cache";

import { requireOperationsAccess } from "@/lib/auth/permissions";
import { getEntityDependencies } from "@/lib/operations/entity-dependencies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { governanceDb } from "@/lib/supabase/governance-client";

import {
  entityDependencySchema,
  executeMovementSchema,
  executeVendorMovementSchema,
  previewMovementSchema,
} from "./schemas";
import { LINE_ASSIGNMENT_META_KEY } from "@/features/campaigns/line-assignment";
import type { MovementPreview } from "./types";

export type OperationsActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  preview?: MovementPreview;
  batchId?: string;
  dependencies?: Awaited<ReturnType<typeof getEntityDependencies>>;
};

function parseCampaignIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadCampaignFinancials(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  campaignIds: string[]
) {
  const { data: headers, error } = await supabase
    .from("campaign_headers")
    .select(
      `
      id, document_number, name, status, group_id, client_id, brand_id,
      start_date, created_at,
      group:groups(name),
      client:clients(name),
      brand:brands(name),
      lines:campaign_lines(revenue, profit, billing_status, invoice_id)
    `
    )
    .in("id", campaignIds);

  if (error) throw new Error(error.message);

  let totalInvoices = 0;
  let affectedCollections = 0;
  const invoiceIds = new Set<string>();

  for (const header of headers ?? []) {
    const lines = (header as { lines: { invoice_id: string | null }[] }).lines;
    for (const line of lines) {
      if (line.invoice_id) invoiceIds.add(line.invoice_id);
    }
  }

  totalInvoices = invoiceIds.size;

  if (invoiceIds.size > 0) {
    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("invoice_id", [...invoiceIds]);
    affectedCollections = count ?? 0;
  }

  const campaigns = (headers ?? []).map((row) => {
    const r = row as {
      id: string;
      document_number: string;
      name: string;
      status: string;
      group_id: string | null;
      client_id: string | null;
      brand_id: string | null;
      start_date: string | null;
      created_at: string;
      group: { name: string } | null;
      client: { name: string } | null;
      brand: { name: string } | null;
      lines: {
        revenue: number;
        profit: number;
        billing_status: string;
        invoice_id: string | null;
      }[];
    };
    const revenue = r.lines.reduce((s, l) => s + Number(l.revenue), 0);
    const gp = r.lines.reduce((s, l) => s + Number(l.profit), 0);
    const billingStatuses = new Set(r.lines.map((l) => l.billing_status));
    const invoiceStatuses = r.lines.filter((l) => l.invoice_id);
    return {
      id: r.id,
      document_number: r.document_number,
      name: r.name,
      status: r.status,
      group_id: r.group_id,
      group_name: r.group?.name ?? null,
      client_id: r.client_id,
      client_name: r.client?.name ?? null,
      brand_id: r.brand_id,
      brand_name: r.brand?.name ?? null,
      revenue,
      gp,
      billing_status:
        billingStatuses.size === 1
          ? [...billingStatuses][0]
          : "mixed",
      invoice_status:
        invoiceStatuses.length === 0
          ? "not_invoiced"
          : invoiceStatuses.length === r.lines.length
            ? "fully_invoiced"
            : "partially_invoiced",
      live_date: r.start_date,
      created_at: r.created_at,
    };
  });

  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalGp = campaigns.reduce((s, c) => s + c.gp, 0);

  return {
    campaigns,
    campaign_count: campaigns.length,
    total_revenue: totalRevenue,
    total_gp: totalGp,
    total_invoices: totalInvoices,
    affected_collections: affectedCollections,
  };
}

export async function previewMovementAction(
  _prev: OperationsActionState,
  formData: FormData
): Promise<OperationsActionState> {
  const parsed = previewMovementSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid preview request." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireOperationsAccess(supabase);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const campaignIds = parseCampaignIds(parsed.data.campaign_ids);
  if (campaignIds.length === 0) {
    return { ok: false, message: "Select at least one campaign." };
  }

  try {
    const preview = await loadCampaignFinancials(supabase, campaignIds);
    return {
      ok: true,
      message: `${preview.campaign_count} campaign(s) ready for movement preview.`,
      preview,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Preview failed.",
    };
  }
}

export async function executeMovementAction(
  _prev: OperationsActionState,
  formData: FormData
): Promise<OperationsActionState> {
  const parsed = executeMovementSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireOperationsAccess(supabase);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const campaignIds = parseCampaignIds(parsed.data.campaign_ids);
  if (campaignIds.length === 0) {
    return { ok: false, message: "Select at least one campaign." };
  }

  const { data: destBrand, error: destError } = await supabase
    .from("brands")
    .select("id, client_id, group_id, name")
    .eq("id", parsed.data.destination_brand_id)
    .maybeSingle();

  if (destError || !destBrand) {
    return { ok: false, message: "Destination brand not found." };
  }

  if (
    destBrand.client_id !== parsed.data.destination_client_id ||
    destBrand.group_id !== parsed.data.destination_group_id
  ) {
    return {
      ok: false,
      message: "Destination hierarchy is inconsistent. Verify group, client, and brand.",
    };
  }

  let preview: Awaited<ReturnType<typeof loadCampaignFinancials>>;
  try {
    preview = await loadCampaignFinancials(supabase, campaignIds);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to load campaigns.",
    };
  }

  const { data: batch, error: batchError } = await governanceDb(supabase)
    .from("movement_batches")
    .insert({
      movement_type: parsed.data.movement_type,
      status: "executing",
      reason: parsed.data.reason,
      source_group_id: parsed.data.source_group_id || null,
      source_client_id: parsed.data.source_client_id || null,
      source_brand_id: parsed.data.source_brand_id || null,
      destination_group_id: parsed.data.destination_group_id,
      destination_client_id: parsed.data.destination_client_id,
      destination_brand_id: parsed.data.destination_brand_id,
      campaign_count: preview.campaign_count,
      total_revenue: preview.total_revenue,
      total_gp: preview.total_gp,
      total_invoices: preview.total_invoices,
      affected_collections: preview.affected_collections,
      preview_snapshot: preview,
      created_by: auth.userId,
    })
    .select("id, document_number")
    .single();

  if (batchError || !batch) {
    return { ok: false, message: batchError?.message ?? "Batch creation failed." };
  }

  const { data: campaigns } = await supabase
    .from("campaign_headers")
    .select("id, group_id, client_id, brand_id")
    .in("id", campaignIds);

  let failed = false;

  for (const campaign of campaigns ?? []) {
    const c = campaign as {
      id: string;
      group_id: string | null;
      client_id: string | null;
      brand_id: string | null;
    };

    const campaignPreview = preview.campaigns.find((p) => p.id === c.id);

    const { error: updateError } = await supabase
      .from("campaign_headers")
      .update({
        group_id: parsed.data.destination_group_id,
        client_id: parsed.data.destination_client_id,
        brand_id: parsed.data.destination_brand_id,
      })
      .eq("id", c.id);

    const itemStatus = updateError ? "failed" : "completed";

    await governanceDb(supabase).from("movement_items").insert({
      batch_id: batch.id,
      campaign_header_id: c.id,
      previous_group_id: c.group_id,
      previous_client_id: c.client_id,
      previous_brand_id: c.brand_id,
      new_group_id: parsed.data.destination_group_id,
      new_client_id: parsed.data.destination_client_id,
      new_brand_id: parsed.data.destination_brand_id,
      revenue: campaignPreview?.revenue ?? 0,
      gp: campaignPreview?.gp ?? 0,
      status: itemStatus,
      error_message: updateError?.message ?? null,
    });

    if (!updateError) {
      await governanceDb(supabase).from("reassignment_logs").insert({
        batch_id: batch.id,
        entity_type: "campaign_header",
        entity_id: c.id,
        action: "moved",
        moved_from: {
          group_id: c.group_id,
          client_id: c.client_id,
          brand_id: c.brand_id,
        },
        moved_to: {
          group_id: parsed.data.destination_group_id,
          client_id: parsed.data.destination_client_id,
          brand_id: parsed.data.destination_brand_id,
        },
        reason: parsed.data.reason,
        affected_records: [{ type: "campaign_lines", preserved: true }],
        actor_id: auth.userId,
      });

      await supabase
        .from("invoices")
        .update({ client_id: parsed.data.destination_client_id })
        .eq("campaign_header_id", c.id);
    } else {
      failed = true;
    }
  }

  await governanceDb(supabase)
    .from("movement_batches")
    .update({
      status: failed ? "failed" : "completed",
      executed_at: new Date().toISOString(),
    })
    .eq("id", batch.id);

  revalidatePath("/operations/move");
  revalidatePath("/operations/reassignment");
  revalidatePath("/campaigns");
  revalidatePath("/groups");
  revalidatePath("/clients");
  revalidatePath("/billing");

  if (failed) {
    return {
      ok: false,
      message: `Movement batch ${batch.document_number} partially failed. Review reassignment center.`,
      batchId: batch.id,
    };
  }

  return {
    ok: true,
    message: `Moved ${preview.campaign_count} campaign(s) — batch ${batch.document_number}.`,
    batchId: batch.id,
  };
}

export async function getEntityDependenciesAction(
  _prev: OperationsActionState,
  formData: FormData
): Promise<OperationsActionState> {
  const parsed = entityDependencySchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid entity." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Unauthorized" };
  }

  try {
    const dependencies = await getEntityDependencies(
      supabase,
      parsed.data.entity_type,
      parsed.data.entity_id
    );
    return { ok: true, dependencies };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Failed to load dependencies.",
    };
  }
}

function parseAssignmentIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function executeVendorMovementAction(
  _prev: OperationsActionState,
  formData: FormData
): Promise<OperationsActionState> {
  const parsed = executeVendorMovementSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (parsed.data.source_influencer_id === parsed.data.destination_influencer_id) {
    return { ok: false, message: "Source and destination vendor must differ." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireOperationsAccess(supabase);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const assignmentIds = parseAssignmentIds(parsed.data.assignment_ids);
  if (assignmentIds.length === 0) {
    return { ok: false, message: "Select at least one assignment." };
  }

  const { data: destVendor } = await supabase
    .from("influencers")
    .select("id, display_name, document_number")
    .eq("id", parsed.data.destination_influencer_id)
    .maybeSingle();

  if (!destVendor) {
    return { ok: false, message: "Destination vendor not found." };
  }

  const { data: assignments } = await supabase
    .from("campaign_influencers")
    .select("id, campaign_line_id, campaign_header_id, campaign_id, agreed_fee")
    .in("id", assignmentIds)
    .eq("influencer_id", parsed.data.source_influencer_id);

  if (!assignments?.length) {
    return { ok: false, message: "No matching assignments found for source vendor." };
  }

  const totalRevenue = assignments.reduce(
    (s, a) => s + Number((a as { agreed_fee: number }).agreed_fee),
    0
  );

  const { data: batch, error: batchError } = await governanceDb(supabase)
    .from("movement_batches")
    .insert({
      movement_type: "vendor_to_vendor",
      status: "executing",
      reason: parsed.data.reason,
      source_influencer_id: parsed.data.source_influencer_id,
      destination_influencer_id: parsed.data.destination_influencer_id,
      campaign_count: assignments.length,
      total_revenue: totalRevenue,
      total_gp: 0,
      preview_snapshot: { assignment_ids: assignmentIds },
      created_by: auth.userId,
    })
    .select("id, document_number")
    .single();

  if (batchError || !batch) {
    return { ok: false, message: batchError?.message ?? "Batch creation failed." };
  }

  for (const row of assignments) {
    const a = row as {
      id: string;
      campaign_line_id: string | null;
      campaign_header_id: string | null;
      campaign_id: string | null;
    };

    const { error: updateError } = await supabase
      .from("campaign_influencers")
      .update({ influencer_id: parsed.data.destination_influencer_id })
      .eq("id", a.id);

    if (!updateError) {
      await supabase
        .from("deliverables")
        .update({ influencer_id: parsed.data.destination_influencer_id })
        .eq("campaign_influencer_id", a.id);

      if (a.campaign_line_id) {
        const { data: lineRow } = await supabase
          .from("campaign_lines")
          .select("metadata")
          .eq("id", a.campaign_line_id)
          .maybeSingle();

        const metadata = (lineRow?.metadata as Record<string, unknown>) ?? {};
        const assignment = metadata[LINE_ASSIGNMENT_META_KEY] as
          | Record<string, unknown>
          | undefined;

        if (assignment) {
          await supabase
            .from("campaign_lines")
            .update({
              metadata: {
                ...metadata,
                [LINE_ASSIGNMENT_META_KEY]: {
                  ...assignment,
                  influencer_id: destVendor.id,
                  influencer_name: destVendor.display_name,
                  influencer_document_number: destVendor.document_number,
                },
              },
            })
            .eq("id", a.campaign_line_id);
        }
      }
    }

    await governanceDb(supabase).from("reassignment_logs").insert({
      batch_id: batch.id,
      entity_type: "campaign_influencer",
      entity_id: a.id,
      action: "vendor_reassigned",
      moved_from: { influencer_id: parsed.data.source_influencer_id },
      moved_to: { influencer_id: parsed.data.destination_influencer_id },
      reason: parsed.data.reason,
      affected_records: [a.campaign_line_id, a.campaign_id].filter(Boolean),
      created_by: auth.userId,
    });
  }

  await governanceDb(supabase)
    .from("movement_batches")
    .update({ status: "completed", executed_at: new Date().toISOString() })
    .eq("id", batch.id);

  revalidatePath("/operations/move");
  revalidatePath("/operations/reassignment");
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${parsed.data.source_influencer_id}`);
  revalidatePath(`/vendors/${parsed.data.destination_influencer_id}`);

  return {
    ok: true,
    message: `Reassigned ${assignments.length} assignment(s) to ${destVendor.display_name}.`,
    batchId: batch.id,
  };
}
