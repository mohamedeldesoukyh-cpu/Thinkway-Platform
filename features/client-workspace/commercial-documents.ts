import { loadClientWorkspace } from "./load-client-workspace";
import { isClientWorkspaceSectionOpen } from "./entitlement";
import { canOpenCommercialWorkspace } from "./selection-flow";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

/** Resolve the same current journey as the page; never trust a caller's document ID. */
export async function resolveCommercialDocuments(token: string) {
  if (token.length < 16 || token.length > 512) throw new Error("This review link is not available.");
  const loaded = await loadClientWorkspace(token, undefined, { documentRequest: true });
  if (!loaded.ok) throw new Error("This review link is not available.");
  const { view } = loaded;
  if (view.linkExpired || !isClientWorkspaceSectionOpen(view.entitlement, "commercial") ||
      !canOpenCommercialWorkspace({ selectionConfirmed: view.journey?.selectionConfirmed, historical: view.journey?.historical, quotationStage: view.journey?.quotationStage })) {
    throw new Error("Commercial documents are not available for this link.");
  }
  const db = tryCreateServiceRoleClient().client;
  if (!db) throw new Error("Documents are temporarily unavailable.");
  return { db, view, quotationId: view.journey?.quotationId ?? view.review.quotationId,
    campaignId: view.journey?.historical ? null : view.journey?.campaignHeaderId ?? view.review.campaignHeaderId };
}
