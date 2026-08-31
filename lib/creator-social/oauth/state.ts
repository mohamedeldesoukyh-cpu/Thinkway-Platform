import type { SupabaseClient } from "@supabase/supabase-js";

import { openSecret, sealSecret } from "@/lib/security/secret-box";

import { CREATOR_SOCIAL_OAUTH_STATE_TTL_MS } from "../copy";
import type { SocialProviderId } from "../ids";
import { generateOAuthState, generatePkceVerifier, hashOAuthState, pkceChallengeS256 } from "./pkce";

export type CreatedOAuthState = {
  state: string;
  codeChallenge: string | null;
  expiresAt: string;
};

export async function createBoundOAuthState(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    provider: SocialProviderId;
    usesPkce: boolean;
    redirectTo?: string;
  }
): Promise<CreatedOAuthState> {
  const state = generateOAuthState();
  const verifier = input.usesPkce ? generatePkceVerifier() : "";
  const expiresAt = new Date(Date.now() + CREATOR_SOCIAL_OAUTH_STATE_TTL_MS).toISOString();
  const { error } = await supabase.from("creator_social_oauth_states").insert({
    state_hash: hashOAuthState(state),
    influencer_id: input.influencerId,
    provider: input.provider,
    code_challenge: input.usesPkce ? pkceChallengeS256(verifier) : null,
    code_verifier_ciphertext: sealSecret(verifier || "n/a"),
    redirect_to: input.redirectTo ?? "/creator-portal/profile",
    expires_at: expiresAt,
  });
  if (error) {
    throw new Error("Could not start the connection.");
  }
  return {
    state,
    codeChallenge: input.usesPkce ? pkceChallengeS256(verifier) : null,
    expiresAt,
  };
}

export type ConsumedOAuthState = {
  influencerId: string;
  provider: SocialProviderId;
  codeVerifier: string | null;
  redirectTo: string;
};

export type OAuthStateFailure = "invalid" | "expired" | "replay" | "provider_mismatch";

export function classifyOAuthState(input: {
  found: boolean;
  consumedAt: string | null;
  expiresAt: string;
  provider: string;
  expectedProvider?: string | null;
  now?: Date;
}): OAuthStateFailure | null {
  if (!input.found) return "invalid";
  if (input.consumedAt) return "replay";
  const now = input.now ?? new Date();
  if (new Date(input.expiresAt).getTime() <= now.getTime()) return "expired";
  if (input.expectedProvider && input.provider !== input.expectedProvider) {
    return "provider_mismatch";
  }
  return null;
}

export async function consumeBoundOAuthState(
  supabase: SupabaseClient,
  input: {
    state: string;
    expectedProvider?: SocialProviderId | null;
    now?: Date;
  }
): Promise<
  | { ok: true; data: ConsumedOAuthState }
  | { ok: false; reason: OAuthStateFailure }
> {
  const hash = hashOAuthState(input.state);
  const { data } = await supabase
    .from("creator_social_oauth_states")
    .select(
      "id, influencer_id, provider, code_verifier_ciphertext, redirect_to, expires_at, consumed_at"
    )
    .eq("state_hash", hash)
    .maybeSingle();

  const classified = classifyOAuthState({
    found: Boolean(data?.id),
    consumedAt: (data?.consumed_at as string | null) ?? null,
    expiresAt: (data?.expires_at as string) ?? "",
    provider: (data?.provider as string) ?? "",
    expectedProvider: input.expectedProvider,
    now: input.now,
  });
  if (classified) return { ok: false, reason: classified };
  if (!data?.id) return { ok: false, reason: "invalid" };

  const now = input.now ?? new Date();
  const { data: claimed, error } = await supabase
    .from("creator_social_oauth_states")
    .update({ consumed_at: now.toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (error || !claimed?.id) return { ok: false, reason: "replay" };

  let verifier: string | null = null;
  try {
    const opened = openSecret(data.code_verifier_ciphertext as string);
    verifier = opened === "n/a" ? null : opened;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    data: {
      influencerId: data.influencer_id as string,
      provider: data.provider as SocialProviderId,
      codeVerifier: verifier,
      redirectTo: (data.redirect_to as string) || "/creator-portal/profile",
    },
  };
}
