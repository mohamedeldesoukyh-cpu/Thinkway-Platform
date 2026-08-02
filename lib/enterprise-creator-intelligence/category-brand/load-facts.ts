import type { SupabaseClient } from "@supabase/supabase-js";

import {
  toPostFact,
  type CategoryBrandPostFact,
} from "@/lib/enterprise-creator-intelligence/category-brand/classify";
import type { CreatorCategoryBrandFacts } from "@/lib/enterprise-creator-intelligence/category-brand/compute";
import { isMissingTableError } from "@/lib/platform/schema-validation";

/**
 * Load content facts for Category & Brand Intelligence.
 * Reuses influencer platform account publications + Thinkway campaign publications.
 */
export async function loadCreatorCategoryBrandFacts(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
  }
): Promise<CreatorCategoryBrandFacts> {
  const influencerId = input.influencerId;

  let accountsQuery = supabase
    .from("influencer_platform_accounts")
    .select(
      "platform, recent_publications, hashtags, mentions, interest_categories"
    )
    .eq("influencer_id", influencerId)
    .limit(20);

  if (input.platform) {
    accountsQuery = accountsQuery.eq("platform", input.platform);
  }

  const [accountsResult, pubsResult] = await Promise.all([
    accountsQuery,
    supabase
      .from("campaign_publications")
      .select(
        "platform, caption, hashtags, mentions, publication_date, content_url, publication_type"
      )
      .eq("influencer_id", influencerId)
      .order("publication_date", { ascending: false })
      .limit(200),
  ]);

  if (
    accountsResult.error &&
    !isMissingTableError(accountsResult.error.message, accountsResult.error.code)
  ) {
    throw new Error(accountsResult.error.message);
  }
  if (
    pubsResult.error &&
    !isMissingTableError(pubsResult.error.message, pubsResult.error.code)
  ) {
    throw new Error(pubsResult.error.message);
  }

  const posts: CategoryBrandPostFact[] = [];
  let platform = input.platform ?? null;

  for (const account of (accountsResult.data ?? []) as Array<
    Record<string, unknown>
  >) {
    platform = platform ?? (account.platform as string | null) ?? null;
    const recent = account.recent_publications;
    if (Array.isArray(recent)) {
      for (const raw of recent) {
        if (!raw || typeof raw !== "object") continue;
        posts.push(toPostFact(raw as Record<string, unknown>));
      }
    }
  }

  for (const row of (pubsResult.data ?? []) as Array<Record<string, unknown>>) {
    platform = platform ?? (row.platform as string | null) ?? null;
    posts.push(
      toPostFact({
        ...row,
        posted_at: row.publication_date,
        url: row.content_url,
      })
    );
  }

  return {
    influencerId,
    platform,
    posts,
  };
}
