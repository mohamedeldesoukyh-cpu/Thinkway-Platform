import type { SupabaseClient } from "@supabase/supabase-js";

import { deliverableStatusTimestamps } from "./campaign-commercial";
import { updateDeliverableStatus } from "./repositories/assignment-repository";

export async function updateLegacyDeliverableStatus(
  supabase: SupabaseClient,
  input: {
    deliverable_id: string;
    status: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const timestamps = deliverableStatusTimestamps(input.status);

  const { error } = await updateDeliverableStatus(supabase, input.deliverable_id, {
    status: input.status,
    ...timestamps,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
