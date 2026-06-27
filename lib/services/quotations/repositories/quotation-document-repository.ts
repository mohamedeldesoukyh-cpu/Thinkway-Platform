import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export async function insertQuotationVersionHistory(
  supabase: SupabaseClient<Database>,
  input: {
    quotationId: string;
    parentQuotationId: string;
    versionNumber: number;
    serialNumber: string;
    revisionNotes: string | null;
    userId: string;
    sourceStatus: string;
  }
) {
  return supabase.from("quotation_version_history").insert({
    quotation_id: input.quotationId,
    parent_quotation_id: input.parentQuotationId,
    version_number: input.versionNumber,
    serial_number: input.serialNumber,
    revision_notes: input.revisionNotes,
    created_by: input.userId,
    metadata: { sourceStatus: input.sourceStatus },
  } as never);
}

export async function insertVersionRevision(
  supabase: SupabaseClient<Database>,
  input: {
    quotationId: string;
    version: string;
    userId: string;
    changeSummary: string;
  }
) {
  return supabase.from("quotation_revisions").insert({
    quotation_id: input.quotationId,
    version: input.version,
    updated_by: input.userId,
    change_summary: input.changeSummary,
  } as never);
}

export async function fetchQuotationLifecycleAudit(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  return supabase
    .from("audit_logs")
    .select("id, action, metadata, created_at, actor:actor_id(full_name)")
    .eq("entity_type", "quotation")
    .eq("entity_id", quotationId)
    .order("created_at", { ascending: false })
    .limit(100);
}

export async function fetchVersionChainSiblings(
  supabase: SupabaseClient<Database>,
  baseSerial: string
) {
  return supabase
    .from("quotations")
    .select("id, serial_number, version_number, status")
    .ilike("serial_number", `${baseSerial}%`)
    .order("version_number", { ascending: true });
}

export async function fetchLinkedShortlistSummary(
  supabase: SupabaseClient<Database>,
  shortlistId: string
) {
  return supabase
    .from("discovery_shortlists")
    .select("id, serial_number")
    .eq("id", shortlistId)
    .maybeSingle();
}

export async function fetchLinkedCampaignSummary(
  supabase: SupabaseClient<Database>,
  campaignHeaderId: string
) {
  return supabase
    .from("campaign_headers")
    .select("id, document_number")
    .eq("id", campaignHeaderId)
    .maybeSingle();
}

export async function fetchQuotationVersionContext(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  return supabase
    .from("quotations")
    .select(
      "id, serial_number, version_number, status, parent_quotation_id, shortlist_id, campaign_header_id"
    )
    .eq("id", quotationId)
    .maybeSingle();
}
