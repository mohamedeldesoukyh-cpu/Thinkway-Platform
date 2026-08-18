"use server";

import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { loadLatestInternalReviewForQuotation } from "../load-client-workspace";
import type { QuotationClientReviewView } from "@/features/quotations/quotation-client-review";

export async function loadQuotationClientReviewAction(
  quotationId: string
): Promise<{ ok: true; review: QuotationClientReviewView | null } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("error" in auth) {
    const writeAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
    if ("error" in writeAuth) return { ok: false, message: auth.error };
  }
  const review = await loadLatestInternalReviewForQuotation(supabase, quotationId);
  if (!review) return { ok: true, review: null };
  return {
    ok: true,
    review: {
      id: review.id,
      reviewNumber: review.reviewNumber,
      status: review.status,
      selectionState: review.selectionState,
      approvedCreatorIds: review.approvedCreatorIds,
      changeRequestSummary: review.changeRequestSummary,
      updatedAt: review.updatedAt,
      approvedAt: review.approvedAt,
    },
  };
}
