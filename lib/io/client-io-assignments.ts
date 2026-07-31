import type { SupabaseClient } from "@supabase/supabase-js";

/** Statuses where Assignment composition may still be edited. */
export const CLIENT_IO_COMPOSER_EDITABLE_STATUSES = new Set([
  "draft",
  "generated",
]);

/** Statuses where regenerate is allowed (pre-send only). */
export const CLIENT_IO_REGENERATE_ALLOWED_STATUSES = new Set([
  "draft",
  "generated",
]);

export function isClientIoComposerEditable(status: string): boolean {
  return CLIENT_IO_COMPOSER_EDITABLE_STATUSES.has(status);
}

export function isClientIoRegenerateAllowed(status: string): boolean {
  return CLIENT_IO_REGENERATE_ALLOWED_STATUSES.has(status);
}

export async function listClientIoAssignmentIds(
  supabase: SupabaseClient,
  clientIoId: string
): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("client_io_assignments")
    .select("campaign_line_id")
    .eq("client_io_id", clientIoId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ campaign_line_id: string }>).map(
    (row) => row.campaign_line_id
  );
}

/**
 * Replace the Assignment selection for a Client IO.
 * Validates that every line belongs to the CIO campaign header.
 */
export async function replaceClientIoAssignments(
  supabase: SupabaseClient,
  input: {
    clientIoId: string;
    campaignHeaderId: string;
    campaignLineIds: string[];
  }
): Promise<string[]> {
  const uniqueIds = [...new Set(input.campaignLineIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length > 0) {
    const { data: lines, error: linesError } = await supabase
      .from("campaign_lines")
      .select("id")
      .eq("campaign_header_id", input.campaignHeaderId)
      .in("id", uniqueIds);

    if (linesError) {
      throw new Error(linesError.message);
    }

    const validIds = new Set(((lines ?? []) as Array<{ id: string }>).map((row) => row.id));
    const invalid = uniqueIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new Error("One or more selected Assignments are not part of this campaign.");
    }
  }

  const { error: deleteError } = await (supabase as any)
    .from("client_io_assignments")
    .delete()
    .eq("client_io_id", input.clientIoId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (uniqueIds.length === 0) {
    return [];
  }

  const { error: insertError } = await (supabase as any).from("client_io_assignments").insert(
    uniqueIds.map((campaign_line_id) => ({
      client_io_id: input.clientIoId,
      campaign_line_id,
    }))
  );

  if (insertError) {
    throw new Error(insertError.message);
  }

  return uniqueIds;
}

/**
 * If the CIO has no junction rows yet, seed every campaign Assignment.
 * Keeps first-open UX as “select all” without forcing empty generate.
 */
export async function ensureClientIoAssignmentsSeeded(
  supabase: SupabaseClient,
  input: {
    clientIoId: string;
    campaignHeaderId: string;
  }
): Promise<string[]> {
  const existing = await listClientIoAssignmentIds(supabase, input.clientIoId);
  if (existing.length > 0) {
    return existing;
  }

  const { data: lines, error } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_header_id", input.campaignHeaderId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const lineIds = ((lines ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (lineIds.length === 0) {
    return [];
  }

  return replaceClientIoAssignments(supabase, {
    clientIoId: input.clientIoId,
    campaignHeaderId: input.campaignHeaderId,
    campaignLineIds: lineIds,
  });
}
