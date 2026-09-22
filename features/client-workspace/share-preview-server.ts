import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import { resolveIoPublicAppOrigin } from "@/lib/io/io-public-app-url";
import { resolveClientReviewByToken } from "./load-client-workspace";
import { loadEntitlementForReview } from "./load-entitlement";
import { clientWorkspaceEntitlementBlock } from "./entitlement";
import { campaignShareMetadata } from "./share-preview";

export const SHARE_COVER_BUCKET = "client-review-covers";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Read-only: preview crawlers must not sync quotations or mark a review as viewed.
export const loadSharePreview = cache(async (reviewId: string, token: string) => {
  if (!UUID.test(reviewId) || token.length < 16 || token.length > 512) return null;
  const db = tryCreateServiceRoleClient().client;
  if (!db) return null;
  const resolved = await resolveClientReviewByToken(db, token);
  if (!resolved.ok) return null;
  const review = resolved.review;
  let ownerId = review.id;
  let members = [review.id];
  if (review.journeyId) {
    const { data, error } = await db.from("campaign_client_reviews")
      .select("id").eq("journey_id", review.journeyId).neq("status", "revoked")
      .order("created_at", { ascending: true });
    if (error) return null;
    members = (data ?? []).map((row) => row.id as string);
    ownerId = members[0] ?? review.id;
  }
  if (reviewId !== review.journeyId && !members.includes(reviewId)) return null;
  const entitlement = await loadEntitlementForReview(db, review);
  if (clientWorkspaceEntitlementBlock(entitlement.clientId, entitlement.entitlement)) return null;
  const { data: cover } = await db.from("client_review_share_covers")
    .select("storage_path, updated_at").eq("review_id", ownerId).maybeSingle();
  return {
    review, ownerId,
    campaignName: review.campaignName || review.sourceSnapshot?.campaignName || "Your campaign",
    coverPath: (cover?.storage_path as string | undefined) ?? null,
    version: (cover?.updated_at as string | undefined) ?? "1",
  };
});

export async function generateReviewShareMetadata({ params, searchParams }: {
  params: Promise<{ reviewId: string }>;
  searchParams: Promise<{ sign?: string }>;
}): Promise<Metadata> {
  const [{ reviewId }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.sign === "string" ? query.sign.trim() : "";
  try {
    const preview = await loadSharePreview(reviewId, token);
    if (preview) return campaignShareMetadata({
      campaignName: preview.campaignName, reviewId, token,
      version: preview.version, origin: resolveIoPublicAppOrigin(),
    });
  } catch { /* Metadata failure must not break the review page. */ }
  return { title: { absolute: "Thinkway · Client review" }, robots: { index: false, follow: false },
    openGraph: { title: "Thinkway · Client review", images: [] }, twitter: { images: [] } };
}
