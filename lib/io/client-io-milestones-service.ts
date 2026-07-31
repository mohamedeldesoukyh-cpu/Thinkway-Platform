import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isClientIoMilestoneEditable,
  mapDbRowToClientIoMilestoneDraft,
  validateClientIoMilestones,
  type ClientIoMilestoneDraft,
} from "@/lib/io/client-io-milestones";

export async function listClientIoMilestones(
  supabase: SupabaseClient,
  clientIoId: string
): Promise<ClientIoMilestoneDraft[]> {
  const { data, error } = await (supabase as any)
    .from("client_io_billing_milestones")
    .select(
      "id, label, milestone_kind, percent, due_trigger, due_offset_days, due_date, notes, sort_order, metadata"
    )
    .eq("client_io_id", clientIoId)
    .order("sort_order", { ascending: true });

  if (error) {
    // Pre-2.2.C columns may be missing on older envs — retry without new fields.
    if (
      error.message.toLowerCase().includes("due_trigger") ||
      error.message.toLowerCase().includes("due_offset") ||
      error.message.toLowerCase().includes("notes")
    ) {
      const legacy = await (supabase as any)
        .from("client_io_billing_milestones")
        .select("id, label, milestone_kind, percent, due_date, sort_order, metadata")
        .eq("client_io_id", clientIoId)
        .order("sort_order", { ascending: true });
      if (legacy.error) throw new Error(legacy.error.message);
      return ((legacy.data ?? []) as Array<Record<string, unknown>>).map((row) =>
        mapDbRowToClientIoMilestoneDraft(row as never)
      );
    }
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapDbRowToClientIoMilestoneDraft(row as never)
  );
}

export async function replaceClientIoMilestones(
  supabase: SupabaseClient,
  input: {
    clientIoId: string;
    campaignHeaderId: string;
    actorId: string;
    status: string;
    isSuperseded?: boolean;
    milestones: ClientIoMilestoneDraft[];
  }
): Promise<ClientIoMilestoneDraft[]> {
  if (!isClientIoMilestoneEditable(input.status, input.isSuperseded)) {
    throw new Error(
      "Billing milestones are locked after the Client IO is sent. Create an amendment to change the schedule."
    );
  }

  const validated = validateClientIoMilestones(input.milestones);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const { error: deleteError } = await (supabase as any)
    .from("client_io_billing_milestones")
    .delete()
    .eq("client_io_id", input.clientIoId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (validated.milestones.length === 0) {
    return [];
  }

  const { data, error: insertError } = await (supabase as any)
    .from("client_io_billing_milestones")
    .insert(
      validated.milestones.map((milestone) => ({
        client_io_id: input.clientIoId,
        label: milestone.label,
        milestone_kind: milestone.milestoneKind,
        percent: milestone.percent,
        due_trigger: milestone.dueTrigger,
        due_offset_days: milestone.dueOffsetDays,
        due_date: milestone.dueDate,
        notes: milestone.notes,
        sort_order: milestone.sortOrder,
        billing_status: "scheduled",
        metadata: {},
        created_by: input.actorId,
        updated_by: input.actorId,
      }))
    )
    .select(
      "id, label, milestone_kind, percent, due_trigger, due_offset_days, due_date, notes, sort_order, metadata"
    );

  if (insertError) {
    throw new Error(insertError.message);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapDbRowToClientIoMilestoneDraft(row as never)
  );
}
