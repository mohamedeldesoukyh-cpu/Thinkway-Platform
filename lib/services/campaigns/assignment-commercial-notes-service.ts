import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAssignmentUsagePeriod } from "@/lib/campaigns/assignment-usage-period";
import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;

export type UpdateAssignmentCommercialNotesInput = {
  campaignId: string;
  lineId: string;
  description?: string | null;
  usagePeriod?: string | null;
};

/**
 * Updates Assignment Full Description + usage period and mirrors description
 * onto the linked quotation item (item + deliverable service_description).
 */
export async function updateAssignmentCommercialNotes(
  supabase: DbClient,
  input: UpdateAssignmentCommercialNotesInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: line, error: lineError } = await supabase
    .from("campaign_lines")
    .select("id, description, metadata, source_quotation_item_id")
    .eq("id", input.lineId)
    .eq("campaign_header_id", input.campaignId)
    .maybeSingle();

  if (lineError || !line) {
    return { ok: false, message: lineError?.message ?? "Assignment not found." };
  }

  const typed = line as {
    id: string;
    description: string | null;
    metadata: Record<string, unknown> | null;
    source_quotation_item_id: string | null;
  };

  const patch: Record<string, unknown> = {};
  let nextDescription = typed.description;

  if (input.description !== undefined) {
    nextDescription = input.description?.trim() || null;
    patch.description = nextDescription;
  }

  if (input.usagePeriod !== undefined) {
    patch.metadata = writeAssignmentUsagePeriod(
      typed.metadata,
      input.usagePeriod
    );
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  const { error: updateError } = await supabase
    .from("campaign_lines")
    .update(patch as never)
    .eq("id", input.lineId)
    .eq("campaign_header_id", input.campaignId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  if (
    input.description !== undefined &&
    typed.source_quotation_item_id
  ) {
    const syncResult = await syncQuotationItemServiceDescription(
      supabase,
      typed.source_quotation_item_id,
      nextDescription
    );
    if (!syncResult.ok) {
      return syncResult;
    }
  }

  return { ok: true };
}

async function syncQuotationItemServiceDescription(
  supabase: DbClient,
  quotationItemId: string,
  description: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: item, error } = await supabase
    .from("quotation_items")
    .select("id, deliverables")
    .eq("id", quotationItemId)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!item) {
    return { ok: true };
  }

  const deliverablesRaw = (item as { deliverables?: unknown }).deliverables;
  let deliverables = deliverablesRaw;
  if (Array.isArray(deliverablesRaw)) {
    deliverables = deliverablesRaw.map((row) => {
      if (!row || typeof row !== "object") return row;
      return {
        ...(row as Record<string, unknown>),
        service_description: description,
      };
    });
  }

  const { error: updateError } = await supabase
    .from("quotation_items")
    .update({
      service_description: description,
      deliverables,
    } as never)
    .eq("id", quotationItemId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  return { ok: true };
}
