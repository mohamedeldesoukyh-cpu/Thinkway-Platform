import type { SupabaseClient } from "@supabase/supabase-js";

import { computeQuotationTotals } from "@/features/quotations/quotation-engine";
import { defaultValidityDateFromIssue } from "@/features/quotations/quotation-validity";
import { logQuotationLifecycleEvent } from "@/lib/commercial-sync/audit";
import {
  canGenerateQuotationVersion,
  formatVersionedQuotationSerial,
  stripQuotationVersionSuffix,
} from "@/lib/commercial-sync/rules";
import type { Database } from "@/types/database";

import { recomputeQuotationTotals } from "./quotation-commercial-service";
import type { QuotationMutationResult } from "./quotation-helpers";
import {
  copyQuotationItems,
  insertVersionedQuotation,
  loadQuotationRow,
  resolveMaxVersionNumber,
  updateQuotationHeaderRecord,
} from "./repositories/quotation-repository";
import {
  fetchLinkedCampaignSummary,
  fetchLinkedShortlistSummary,
  fetchQuotationVersionContext,
  fetchVersionChainSiblings,
  insertQuotationVersionHistory,
  insertVersionRevision,
} from "./repositories/quotation-document-repository";

export async function generateQuotationVersion(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { quotationId: string; revisionNotes?: string | null }
): Promise<
  QuotationMutationResult<{
    newQuotationId: string;
    versionNumber: number;
    serialNumber: string;
    shortlistId: string | null;
  }>
> {
  const row = await loadQuotationRow(supabase, input.quotationId);
  if (!row) return { ok: false, message: "Quotation not found." };

  const status = row.status as Database["public"]["Tables"]["quotations"]["Row"]["status"];
  if (!canGenerateQuotationVersion(status)) {
    return {
      ok: false,
      message: "New versions can only be generated after the quotation is sent or approved.",
    };
  }

  const baseSerial = stripQuotationVersionSuffix(row.serial_number as string | null);
  if (!baseSerial) {
    return { ok: false, message: "Quotation serial is missing; cannot generate version." };
  }

  const rootId = (row.parent_quotation_id as string | null) ?? (row.id as string);
  const nextVersion =
    (await resolveMaxVersionNumber(supabase, baseSerial, rootId, stripQuotationVersionSuffix)) + 1;
  const versionSerial = formatVersionedQuotationSerial(baseSerial, nextVersion);
  const issueDate = new Date().toISOString().slice(0, 10);
  const validityDate = defaultValidityDateFromIssue(issueDate);

  const { data: created, error } = await insertVersionedQuotation(supabase, row, {
    userId,
    nextVersion,
    versionSerial,
    revisionNotes: input.revisionNotes,
    issueDate,
    validityDate,
  });

  if (error || !created) {
    return { ok: false, message: error?.message ?? "Failed to create quotation version." };
  }

  const newId = (created as { id: string }).id;
  await copyQuotationItems(supabase, input.quotationId, newId);

  const { data: itemRows } = await supabase
    .from("quotation_items")
    .select("cost_egp, revenue_egp, gp_value_egp, af_value_egp")
    .eq("quotation_id", newId);

  const totals = computeQuotationTotals(
    (itemRows ?? []).map((r) => ({
      cost_egp: Number((r as { cost_egp: number }).cost_egp ?? 0),
      revenue_egp: Number((r as { revenue_egp: number }).revenue_egp ?? 0),
      gp_value_egp: Number((r as { gp_value_egp: number }).gp_value_egp ?? 0),
      af_value_egp: Number((r as { af_value_egp: number }).af_value_egp ?? 0),
    }))
  );

  await updateQuotationHeaderRecord(supabase, newId, {
    total_cost_egp: totals.totalCostEgp,
    total_revenue_egp: totals.totalRevenueEgp,
    total_gp_value_egp: totals.totalGpValueEgp,
    total_gp_pct: totals.totalGpPct,
    total_af_egp: totals.totalAfValueEgp,
    total_agency_margin_egp: totals.totalAgencyMarginEgp,
  });

  await insertQuotationVersionHistory(supabase, {
    quotationId: newId,
    parentQuotationId: input.quotationId,
    versionNumber: nextVersion,
    serialNumber: versionSerial,
    revisionNotes: input.revisionNotes?.trim() || null,
    userId,
    sourceStatus: status,
  });

  await insertVersionRevision(supabase, {
    quotationId: newId,
    version: `v${nextVersion}.0`,
    userId,
    changeSummary: input.revisionNotes?.trim() || `Generated version V${nextVersion}`,
  });

  await logQuotationLifecycleEvent(supabase, {
    quotationId: input.quotationId,
    actorId: userId,
    event: "quotation.version_created",
    summary: `Generated quotation version ${versionSerial}.`,
    metadata: { newQuotationId: newId, versionNumber: nextVersion },
  });

  return {
    ok: true,
    data: {
      newQuotationId: newId,
      versionNumber: nextVersion,
      serialNumber: versionSerial,
      shortlistId: (row.shortlist_id as string | null) ?? null,
    },
    message: `Version ${versionSerial} created as draft.`,
  };
}

export async function getQuotationVersionChain(
  supabase: SupabaseClient<Database>,
  quotationId: string
): Promise<
  QuotationMutationResult<{
    versions: Array<{
      id: string;
      serial_number: string | null;
      version_number: number;
      status: string;
    }>;
    linkedShortlist: { id: string; serial_number: string | null } | null;
    linkedCampaign: { id: string; document_number: string } | null;
  }>
> {
  const { data: current } = await fetchQuotationVersionContext(supabase, quotationId);
  if (!current) return { ok: false, message: "Quotation not found." };

  const cur = current as {
    id: string;
    serial_number: string | null;
    version_number: number;
    status: string;
    parent_quotation_id: string | null;
    shortlist_id: string | null;
    campaign_header_id: string | null;
  };

  const baseSerial = stripQuotationVersionSuffix(cur.serial_number);
  const { data: siblings } = await fetchVersionChainSiblings(supabase, baseSerial);

  let linkedShortlist: { id: string; serial_number: string | null } | null = null;
  if (cur.shortlist_id) {
    const { data: sl } = await fetchLinkedShortlistSummary(supabase, cur.shortlist_id);
    if (sl) linkedShortlist = sl as { id: string; serial_number: string | null };
  }

  let linkedCampaign: { id: string; document_number: string } | null = null;
  if (cur.campaign_header_id) {
    const { data: ch } = await fetchLinkedCampaignSummary(supabase, cur.campaign_header_id);
    if (ch) linkedCampaign = ch as { id: string; document_number: string };
  }

  return {
    ok: true,
    data: {
      versions: ((siblings ?? []) as Array<{
        id: string;
        serial_number: string | null;
        version_number: number;
        status: string;
      }>) ?? [cur],
      linkedShortlist,
      linkedCampaign,
    },
  };
}

export { stripQuotationVersionSuffix };
