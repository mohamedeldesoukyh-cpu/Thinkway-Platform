import type { SupabaseClient } from "@supabase/supabase-js";

import { deleteConnectionCredentials, readConnectionCredentials, writeConnectionCredentials } from "../credentials/store";
import { matchPublicationInsight } from "../insights/match-publication";
import type { NormalizedSocialInsight } from "../insights/types";
import type { SocialProviderId } from "../ids";
import { getSocialProvider } from "../providers/registry";
import type { SocialAccountIdentity, SocialTokenSet } from "../providers/types";
import { invalidateCreatorInsightCache } from "@/lib/creator-insights/cache";
import type { CreatorSocialConnectionStatus } from "./status";

export type CreatorSocialConnectionRow = {
  id: string;
  influencer_id: string;
  provider: SocialProviderId;
  external_account_id: string;
  external_username: string | null;
  external_display_name: string | null;
  status: CreatorSocialConnectionStatus;
  scopes: string[];
  capabilities: string[];
  connected_at: string | null;
  last_synced_at: string | null;
  disconnected_at: string | null;
  last_error_code: string | null;
};

export async function listConnectionsForInfluencer(
  supabase: SupabaseClient,
  influencerId: string
): Promise<CreatorSocialConnectionRow[]> {
  const { data } = await supabase
    .from("creator_social_connections")
    .select(
      "id, influencer_id, provider, external_account_id, external_username, external_display_name, status, scopes, capabilities, connected_at, last_synced_at, disconnected_at, last_error_code"
    )
    .eq("influencer_id", influencerId)
    .order("connected_at", { ascending: false });
  return (data ?? []) as CreatorSocialConnectionRow[];
}

export async function upsertActiveConnection(input: {
  supabase: SupabaseClient;
  influencerId: string;
  provider: SocialProviderId;
  identity: SocialAccountIdentity;
  tokens: SocialTokenSet;
  scopes: readonly string[];
  capabilities: readonly string[];
}): Promise<{ connectionId: string; created: boolean }> {
  const now = new Date().toISOString();
  const { data: sameAccount } = await input.supabase
    .from("creator_social_connections")
    .select("id, influencer_id, disconnected_at")
    .eq("provider", input.provider)
    .eq("external_account_id", input.identity.externalAccountId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    sameAccount?.id &&
    !sameAccount.disconnected_at &&
    sameAccount.influencer_id !== input.influencerId
  ) {
    throw new Error("This social account is already connected to another creator.");
  }

  const reusable =
    sameAccount?.id && sameAccount.influencer_id === input.influencerId
      ? sameAccount
      : null;

  if (reusable?.id) {
    await input.supabase
      .from("creator_social_connections")
      .update({
        influencer_id: input.influencerId,
        external_username: input.identity.username,
        external_display_name: input.identity.displayName,
        status: "syncing",
        scopes: [...input.scopes],
        capabilities: [...input.capabilities],
        connected_at: now,
        disconnected_at: null,
        last_error_code: null,
        updated_at: now,
      })
      .eq("id", reusable.id);
    await writeConnectionCredentials(input.supabase, reusable.id, input.tokens);
    return { connectionId: reusable.id, created: false };
  }

  const { data: inserted, error } = await input.supabase
    .from("creator_social_connections")
    .insert({
      influencer_id: input.influencerId,
      provider: input.provider,
      external_account_id: input.identity.externalAccountId,
      external_username: input.identity.username,
      external_display_name: input.identity.displayName,
      status: "syncing",
      scopes: [...input.scopes],
      capabilities: [...input.capabilities],
      connected_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (error || !inserted?.id) {
    throw new Error(error?.message ?? "Could not save the connection.");
  }
  await writeConnectionCredentials(input.supabase, inserted.id, input.tokens);
  return { connectionId: inserted.id, created: true };
}

export async function disconnectConnection(input: {
  supabase: SupabaseClient;
  connectionId: string;
  influencerId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data } = await input.supabase
    .from("creator_social_connections")
    .select("id, influencer_id, provider")
    .eq("id", input.connectionId)
    .maybeSingle();
  if (!data?.id) return { ok: false, message: "Connection not found." };
  if (data.influencer_id !== input.influencerId) {
    return { ok: false, message: "You cannot change another creator's connection." };
  }

  const provider = getSocialProvider(data.provider as SocialProviderId);
  const tokens = await readConnectionCredentials(input.supabase, data.id);
  if (tokens && provider.revoke) {
    try {
      await provider.revoke(tokens);
    } catch {
      // Revoke is best-effort; Thinkway still disables the connection.
    }
  }

  const now = new Date().toISOString();
  await deleteConnectionCredentials(input.supabase, data.id);
  await input.supabase
    .from("creator_social_connections")
    .update({
      status: "disconnected",
      disconnected_at: now,
      last_error_code: null,
      updated_at: now,
    })
    .eq("id", data.id);
  return { ok: true };
}

export async function requireOwnedConnection(
  supabase: SupabaseClient,
  connectionId: string,
  influencerId: string
): Promise<CreatorSocialConnectionRow | null> {
  const { data } = await supabase
    .from("creator_social_connections")
    .select(
      "id, influencer_id, provider, external_account_id, external_username, external_display_name, status, scopes, capabilities, connected_at, last_synced_at, disconnected_at, last_error_code"
    )
    .eq("id", connectionId)
    .eq("influencer_id", influencerId)
    .maybeSingle();
  return (data as CreatorSocialConnectionRow | null) ?? null;
}

export async function persistInsights(input: {
  supabase: SupabaseClient;
  connection: CreatorSocialConnectionRow;
  insights: readonly NormalizedSocialInsight[];
}): Promise<void> {
  if (input.insights.length === 0) return;
  const { data: publications } = await input.supabase
    .from("campaign_publications")
    .select("id, influencer_id, platform, content_url, external_media_id")
    .eq("influencer_id", input.connection.influencer_id);

  const candidates = (publications ?? []).map((row) => ({
    id: row.id as string,
    influencerId: row.influencer_id as string,
    platform: (row.platform as string | null) ?? null,
    contentUrl: (row.content_url as string | null) ?? null,
    externalMediaId: (row.external_media_id as string | null) ?? null,
  }));

  for (const insight of input.insights) {
    const match = matchPublicationInsight({
      ownerInfluencerId: input.connection.influencer_id,
      insight,
      publications: candidates,
    });
    await input.supabase.from("creator_social_insights").upsert(
      {
        connection_id: input.connection.id,
        influencer_id: input.connection.influencer_id,
        provider: insight.provider,
        insight_kind: insight.insightKind,
        external_content_id: insight.externalContentId ?? "",
        canonical_url: insight.canonicalUrl,
        published_at: insight.publishedAt,
        content_type: insight.contentType,
        views: insight.views,
        reach: insight.reach,
        impressions: insight.impressions,
        likes: insight.likes,
        comments: insight.comments,
        shares: insight.shares,
        saves: insight.saves,
        engagement_rate: insight.engagementRate,
        followers: insight.followers,
        publication_id: match.publicationId,
        match_status: match.matchStatus,
        captured_at: new Date().toISOString(),
      },
      {
        onConflict: "connection_id,insight_kind,external_content_id",
      }
    );
  }
  invalidateCreatorInsightCache(input.connection.influencer_id);
}
