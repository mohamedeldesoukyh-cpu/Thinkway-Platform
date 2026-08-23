import type { SupabaseClient } from "@supabase/supabase-js";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://dev.thinkwaymedia.com").replace(/\/$/, "");
}

async function linkedQuotationId(
  supabase: SupabaseClient,
  shortlistId: string
): Promise<string | null> {
  const { resolveCurrentQuotationIdForClientJourney } = await import("./live-quotation-projection");
  return resolveCurrentQuotationIdForClientJourney(supabase, {
    quotationId: null,
    shortlistId,
  });
}

async function linkedShortlistId(
  supabase: SupabaseClient,
  quotationId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("quotations")
    .select("shortlist_id")
    .eq("id", quotationId)
    .maybeSingle();
  return (data as { shortlist_id?: string | null } | null)?.shortlist_id ?? null;
}

/** Keep an open Client Workspace roster aligned with live shortlist and quotation membership. */
export async function syncOpenClientWorkspaceRoster(
  supabase: SupabaseClient,
  input: {
    userId?: string;
    shortlistId?: string | null;
    quotationId?: string | null;
  }
): Promise<void> {
  const userId = input.userId?.trim() || SYSTEM_USER_ID;
  const origin = appOrigin();
  let shortlistId = input.shortlistId?.trim() || null;
  let quotationId = input.quotationId?.trim() || null;
  if (quotationId && !shortlistId) {
    shortlistId = await linkedShortlistId(supabase, quotationId);
  }
  if (shortlistId && !quotationId) {
    quotationId = await linkedQuotationId(supabase, shortlistId);
  }

  if (shortlistId) {
    const { createClientReviewFromShortlist } = await import("./create-from-shortlist");
    await createClientReviewFromShortlist(supabase, {
      shortlistId,
      userId,
      origin,
      mintMissingShareToken: false,
      syncExistingOnly: true,
    });
  }
  if (quotationId) {
    const { createClientReviewFromQuotation } = await import("./create-from-quotation");
    await createClientReviewFromQuotation(supabase, {
      quotationId,
      userId,
      origin,
      mintMissingShareToken: false,
      syncExistingOnly: true,
    });
  }
}

export async function syncOpenClientWorkspaceRosterBestEffort(
  supabase: SupabaseClient,
  input: {
    userId?: string;
    shortlistId?: string | null;
    quotationId?: string | null;
  }
): Promise<void> {
  try {
    await syncOpenClientWorkspaceRoster(supabase, input);
  } catch (error) {
    console.error("[client-workspace-roster-sync]", error);
  }
}
