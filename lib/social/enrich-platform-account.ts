import { findDuplicatePlatformAccounts } from "@/lib/social/duplicate-check";
import { enrichCreatorProfile } from "@/lib/social/enrichment/providers/open-graph";
import type { EnrichmentResult } from "@/lib/social/enrichment/types";
import {
  parseProfileInput,
  resolvePlatformAccountFields,
  type ParsedProfile,
} from "@/lib/social/parse-profile-url";
import { isSocialPlatform } from "@/lib/social/platforms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EnrichPlatformAccountInput = {
  profile_url?: string;
  username?: string;
  platform?: string;
  influencer_id?: string;
  account_id?: string;
  skip_enrichment?: boolean;
};

export type EnrichPlatformAccountResponse = {
  parsed: ParsedProfile | null;
  enrichment: EnrichmentResult | null;
  duplicates: Awaited<ReturnType<typeof findDuplicatePlatformAccounts>>;
  error?: string;
};

export type ProfileEnrichmentPayload = Omit<
  EnrichPlatformAccountResponse,
  "error"
> & {
  parsed: ParsedProfile;
};

export async function enrichPlatformAccount(
  input: EnrichPlatformAccountInput
): Promise<EnrichPlatformAccountResponse> {
  const parsed =
    (input.profile_url ? parseProfileInput(input.profile_url) : null) ??
    resolvePlatformAccountFields({
      profile_url: input.profile_url,
      username: input.username,
      platform: input.platform,
    });

  if (!parsed) {
    return {
      parsed: null,
      enrichment: null,
      duplicates: [],
      error: "Could not detect platform or username from this URL.",
    };
  }

  if (!isSocialPlatform(parsed.platform)) {
    return {
      parsed,
      enrichment: null,
      duplicates: [],
      error: "Unsupported platform.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      parsed,
      enrichment: null,
      duplicates: [],
      error: authError?.message ?? "Unauthorized",
    };
  }

  let enrichment: EnrichmentResult | null = null;
  if (!input.skip_enrichment) {
    enrichment = await enrichCreatorProfile({
      platform: parsed.platform,
      username: parsed.username,
      profile_url: parsed.profile_url,
    });
  }

  let duplicates: EnrichPlatformAccountResponse["duplicates"] = [];
  try {
    duplicates = await findDuplicatePlatformAccounts(supabase, {
      platform: parsed.platform,
      normalized_username: parsed.normalized_username,
      normalized_profile_url: parsed.normalized_profile_url,
      exclude_influencer_id: input.influencer_id ?? null,
      exclude_account_id: input.account_id ?? null,
    });
  } catch (error) {
    return {
      parsed,
      enrichment,
      duplicates: [],
      error:
        error instanceof Error
          ? error.message
          : "Duplicate check failed.",
    };
  }

  return { parsed, enrichment, duplicates };
}
