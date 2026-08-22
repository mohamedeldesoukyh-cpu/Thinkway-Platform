import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import type { Database } from "@/types/database";

import { creatorProfileSyncFingerprint } from "./creator-snapshot";
import { overlayQuotationDetailOnCreators } from "./quotation-client-overlay";
import { fingerprintFromSnapshotCreators } from "./snapshot";
import { quotationItemsForClient } from "./source-readiness";
import { isInteractiveClientReview } from "./status";
import type { ClientReviewRecord, ClientReviewSourceSnapshot } from "./types";

export async function resolveCurrentQuotationIdForClientJourney(
  supabase: SupabaseClient,
  input: { quotationId?: string | null; shortlistId?: string | null }
): Promise<string | null> {
  if (input.shortlistId?.trim()) {
    const { data } = await supabase
      .from("quotations")
      .select("id, status, version_number, updated_at, is_archived")
      .eq("shortlist_id", input.shortlistId)
      .eq("is_archived", false)
      .order("version_number", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(8);
    const rows = (data ?? []) as Array<{
      id: string;
      status: string;
      version_number: number | null;
      updated_at: string;
      is_archived: boolean;
    }>;
    const current = rows.find((row) => row.status !== "cancelled" && row.status !== "archived");
    if (current?.id) return current.id;
  }
  if (input.quotationId?.trim()) return input.quotationId.trim();
  return null;
}

export async function projectCurrentQuotationOntoSnapshot(
  supabase: SupabaseClient,
  snapshot: ClientReviewSourceSnapshot,
  quotationId: string
): Promise<ClientReviewSourceSnapshot | null> {
  const { getQuotationDetail } = await import("@/lib/services/quotations/quotation-document-service");
  const detail = await getQuotationDetail(supabase as SupabaseClient<Database>, quotationId);
  if (!detail) return null;
  const items = quotationItemsForClient(detail.items);
  const quotationFxRateToEgp = await resolveRateToEgp(supabase, detail.currency, detail.issue_date);
  const creators =
    items.length > 0
      ? overlayQuotationDetailOnCreators(snapshot.creators, items, detail.currency, quotationFxRateToEgp)
      : snapshot.creators.map((creator) => ({
          ...creator,
          investmentCurrency: detail.currency,
        }));
  const priced = creators.filter(
    (creator) => creator.quotationEligible && creator.investmentAmount != null && creator.investmentAmount > 0
  );
  const creatorInvestment = priced.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0);
  return {
    ...snapshot,
    creators,
    creatorIds: creators.map((creator) => creator.creatorId),
    commercial: {
      ...snapshot.commercial,
      currency: detail.currency,
      creatorInvestment,
      totalInvestment: creatorInvestment,
      quotationTotal: creatorInvestment,
      lines: priced.map((creator) => ({
        label: creator.displayName,
        amount: creator.investmentAmount,
      })),
      totalCount: creators.length,
    },
    quotation: {
      id: detail.id,
      serialNumber: detail.serial_number,
      name: detail.name,
      version: detail.version,
      lines: priced.map((creator) => ({
        creatorId: creator.creatorId,
        label: creator.displayName,
        amount: creator.investmentAmount ?? 0,
      })),
    },
  };
}

export function quotationProjectionFingerprint(snapshot: ClientReviewSourceSnapshot): Record<string, unknown> {
  return fingerprintFromSnapshotCreators(snapshot.creators, {
    currency: snapshot.commercial.currency,
    quotationId: snapshot.quotation?.id,
    version: snapshot.quotation?.version,
    profile: creatorProfileSyncFingerprint(snapshot.creators),
  });
}

export async function persistInteractiveReviewProjection(input: {
  supabase: SupabaseClient;
  review: Pick<ClientReviewRecord, "id" | "status" | "quotationId">;
  snapshot: ClientReviewSourceSnapshot;
  previousFingerprint?: Record<string, unknown> | null;
  quotationId?: string | null;
}): Promise<boolean> {
  if (!isInteractiveClientReview(input.review.status)) return false;
  const fingerprint = quotationProjectionFingerprint(input.snapshot);
  if (
    input.previousFingerprint &&
    JSON.stringify(input.previousFingerprint) === JSON.stringify(fingerprint)
  ) {
    return false;
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    source_snapshot: input.snapshot,
    package_fingerprint: fingerprint,
    updated_at: now,
  };
  if (input.quotationId && !input.review.quotationId) patch.quotation_id = input.quotationId;
  const { error } = await input.supabase
    .from("campaign_client_reviews" as never)
    .update(patch as never)
    .eq("id", input.review.id)
    .in("status", ["awaiting_review", "changes_requested"]);
  return !error;
}
