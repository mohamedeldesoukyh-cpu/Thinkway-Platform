import type { SupabaseClient } from "@supabase/supabase-js";

export type DuplicatePlatformAccount = {
  account_id: string;
  influencer_id: string;
  influencer_name: string;
  influencer_document_number: string;
  platform: string;
  username: string;
  profile_url: string | null;
};

type InfluencerEmbed = {
  id: string;
  display_name: string;
  document_number: string;
};

type DuplicateQueryRow = {
  id: string;
  platform: string;
  username: string | null;
  handle: string;
  profile_url: string | null;
  influencer_id: string;
  influencer: InfluencerEmbed | InfluencerEmbed[] | null;
};

function readInfluencerEmbed(
  embed: InfluencerEmbed | InfluencerEmbed[] | null
): InfluencerEmbed | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

const DUPLICATE_SELECT = `
  id, platform, username, handle, profile_url, influencer_id,
  influencer:influencers!influencer_platform_accounts_influencer_id_fkey(
    id, display_name, document_number
  )
`;

export async function findDuplicatePlatformAccounts(
  supabase: SupabaseClient,
  input: {
    platform: string;
    normalized_username: string;
    normalized_profile_url?: string | null;
    exclude_influencer_id?: string | null;
    exclude_account_id?: string | null;
  }
): Promise<DuplicatePlatformAccount[]> {
  const duplicates: DuplicatePlatformAccount[] = [];

  if (input.normalized_username) {
    let query = supabase
      .from("influencer_platform_accounts")
      .select(DUPLICATE_SELECT)
      .eq("platform", input.platform)
      .eq("normalized_username", input.normalized_username);

    if (input.exclude_account_id) {
      query = query.neq("id", input.exclude_account_id);
    }

    const { data, error } = await query.limit(10);
    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as DuplicateQueryRow[]) {
      const account = row;

      if (
        input.exclude_influencer_id &&
        account.influencer_id === input.exclude_influencer_id
      ) {
        continue;
      }

      duplicates.push({
        account_id: account.id,
        influencer_id: account.influencer_id,
        influencer_name:
          readInfluencerEmbed(account.influencer)?.display_name ?? "Unknown vendor",
        influencer_document_number:
          readInfluencerEmbed(account.influencer)?.document_number ?? "",
        platform: account.platform,
        username: account.username ?? account.handle,
        profile_url: account.profile_url,
      });
    }
  }

  if (duplicates.length > 0 || !input.normalized_profile_url) {
    return duplicates;
  }

  let urlQuery = supabase
    .from("influencer_platform_accounts")
    .select(DUPLICATE_SELECT)
    .eq("platform", input.platform)
    .eq("normalized_profile_url", input.normalized_profile_url);

  if (input.exclude_account_id) {
    urlQuery = urlQuery.neq("id", input.exclude_account_id);
  }

  const { data: urlMatches, error: urlError } = await urlQuery.limit(10);
  if (urlError) throw new Error(urlError.message);

  for (const row of (urlMatches ?? []) as DuplicateQueryRow[]) {
    const account = row;

    if (
      input.exclude_influencer_id &&
      account.influencer_id === input.exclude_influencer_id
    ) {
      continue;
    }

    if (duplicates.some((d) => d.account_id === account.id)) continue;

    duplicates.push({
      account_id: account.id,
      influencer_id: account.influencer_id,
      influencer_name:
        readInfluencerEmbed(account.influencer)?.display_name ?? "Unknown vendor",
      influencer_document_number:
        readInfluencerEmbed(account.influencer)?.document_number ?? "",
      platform: account.platform,
      username: account.username ?? account.handle,
      profile_url: account.profile_url,
    });
  }

  return duplicates;
}
