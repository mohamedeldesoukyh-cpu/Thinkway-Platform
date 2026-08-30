import type { SupabaseClient } from "@supabase/supabase-js";

import { persistInsights } from "../connections/service";
import type { CreatorSocialConnectionRow } from "../connections/service";
import { readConnectionCredentials, writeConnectionCredentials } from "../credentials/store";
import { createEmptyInsight } from "../insights/normalize";
import { getSocialProvider } from "../providers/registry";
import { invalidateCreatorInsightCache } from "@/lib/creator-insights/cache";
import type { SocialProviderId } from "../ids";

const UNRECOVERABLE = new Set([
  "token_expired",
  "refresh_failure",
  "disconnected_externally",
]);

export type CreatorSocialSyncOutcome = {
  connectionId: string;
  status: "connected" | "syncing" | "needs_attention" | "skipped";
  errorCode: string | null;
};

async function loadConnection(
  supabase: SupabaseClient,
  connectionId: string
): Promise<CreatorSocialConnectionRow | null> {
  const { data } = await supabase
    .from("creator_social_connections")
    .select(
      "id, influencer_id, provider, external_account_id, external_username, external_display_name, status, scopes, capabilities, connected_at, last_synced_at, disconnected_at, last_error_code"
    )
    .eq("id", connectionId)
    .maybeSingle();
  return (data as CreatorSocialConnectionRow | null) ?? null;
}

export async function processCreatorSocialSyncJob(
  supabase: SupabaseClient,
  input: { connectionId: string; influencerId: string }
): Promise<CreatorSocialSyncOutcome> {
  const connection = await loadConnection(supabase, input.connectionId);
  if (!connection || connection.influencer_id !== input.influencerId) {
    return { connectionId: input.connectionId, status: "skipped", errorCode: "not_found" };
  }
  if (connection.disconnected_at || connection.status === "disconnected") {
    return { connectionId: connection.id, status: "skipped", errorCode: "disconnected" };
  }

  const provider = getSocialProvider(connection.provider as SocialProviderId);
  let tokens = await readConnectionCredentials(supabase, connection.id);
  if (!tokens) {
    await markNeedsAttention(supabase, connection.id, "token_expired");
    return { connectionId: connection.id, status: "needs_attention", errorCode: "token_expired" };
  }

  if (tokens.expiresAt && new Date(tokens.expiresAt).getTime() <= Date.now()) {
    if (!provider.refreshTokens) {
      await markNeedsAttention(supabase, connection.id, "token_expired");
      return { connectionId: connection.id, status: "needs_attention", errorCode: "token_expired" };
    }
    try {
      tokens = await provider.refreshTokens(tokens);
      await writeConnectionCredentials(supabase, connection.id, tokens);
    } catch {
      await markNeedsAttention(supabase, connection.id, "refresh_failure");
      return { connectionId: connection.id, status: "needs_attention", errorCode: "refresh_failure" };
    }
  }

  try {
    const insights = provider.syncInsights
      ? await provider.syncInsights(tokens)
      : [createEmptyInsight(connection.provider, "account")];
    await persistInsights({ supabase, connection, insights });
    const now = new Date().toISOString();
    await supabase
      .from("creator_social_connections")
      .update({
        status: "connected",
        last_synced_at: now,
        last_error_code: null,
        updated_at: now,
      })
      .eq("id", connection.id);
    invalidateCreatorInsightCache(connection.influencer_id);
    return { connectionId: connection.id, status: "connected", errorCode: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = classifySyncError(message);
    if (UNRECOVERABLE.has(code)) {
      await markNeedsAttention(supabase, connection.id, code);
      return { connectionId: connection.id, status: "needs_attention", errorCode: code };
    }
    await supabase
      .from("creator_social_connections")
      .update({
        status: "needs_attention",
        last_error_code: code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);
    return { connectionId: connection.id, status: "needs_attention", errorCode: code };
  }
}

function classifySyncError(message: string): string {
  if (/rate limit|429/i.test(message)) return "rate_limit";
  if (/expired|invalid.?token/i.test(message)) return "token_expired";
  if (/revoked|disconnected/i.test(message)) return "disconnected_externally";
  return "provider_api_failure";
}

async function markNeedsAttention(
  supabase: SupabaseClient,
  connectionId: string,
  errorCode: string
) {
  await supabase
    .from("creator_social_connections")
    .update({
      status: "needs_attention",
      last_error_code: errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}
