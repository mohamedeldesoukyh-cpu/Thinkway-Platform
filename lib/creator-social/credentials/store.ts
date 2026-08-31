import type { SupabaseClient } from "@supabase/supabase-js";

import { openSecret, sealSecret } from "@/lib/security/secret-box";

import type { SocialTokenSet } from "../providers/types";

export async function writeConnectionCredentials(
  supabase: SupabaseClient,
  connectionId: string,
  tokens: SocialTokenSet
): Promise<void> {
  const ciphertext = sealSecret(
    JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresAt: tokens.expiresAt,
    })
  );
  const { error } = await supabase.from("creator_social_credentials").upsert(
    {
      connection_id: connectionId,
      ciphertext,
      token_expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "connection_id" }
  );
  if (error) {
    throw new Error("Could not store the connection securely.");
  }
}

export async function readConnectionCredentials(
  supabase: SupabaseClient,
  connectionId: string
): Promise<SocialTokenSet | null> {
  const { data } = await supabase
    .from("creator_social_credentials")
    .select("ciphertext")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!data?.ciphertext) return null;
  const parsed = JSON.parse(openSecret(data.ciphertext as string)) as SocialTokenSet;
  if (!parsed.accessToken) return null;
  return parsed;
}

export async function deleteConnectionCredentials(
  supabase: SupabaseClient,
  connectionId: string
): Promise<void> {
  await supabase.from("creator_social_credentials").delete().eq("connection_id", connectionId);
}
