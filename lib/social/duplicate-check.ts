import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProfileInput } from "./parse-profile-url";

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
  normalized_profile_url?: string | null;
  influencer: InfluencerEmbed | InfluencerEmbed[] | null;
};

function readInfluencerEmbed(
  embed: InfluencerEmbed | InfluencerEmbed[] | null
): InfluencerEmbed | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

const DUPLICATE_SELECT = `
  id, platform, username, handle, profile_url, normalized_profile_url, influencer_id,
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
  // A supplied profile link is authoritative even if a stale name/handle was submitted.
  const identity = input.normalized_profile_url ? parseProfileInput(input.normalized_profile_url) : null;
  if (identity) {
    input = { ...input, platform: identity.platform, normalized_username: identity.normalized_username,
      normalized_profile_url: identity.normalized_profile_url };
  }
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

  // Older imports can have empty normalized columns. Match their stored identity
  // too; escape LIKE wildcards so underscores in handles stay literal.
  if (duplicates.length === 0 && input.normalized_username) {
    const escaped = input.normalized_username.replace(/[\\%_]/g, "\\$&");
    for (const column of ["username", "handle"] as const) {
      for (const prefix of ["", "@"]) {
        let query = supabase.from("influencer_platform_accounts")
          .select(DUPLICATE_SELECT)
          .eq("platform", input.platform)
          .ilike(column, `${prefix}${escaped}`);
        if (input.exclude_account_id) query = query.neq("id", input.exclude_account_id);
        const { data, error } = await query.limit(10);
        if (error) throw new Error(error.message);
        for (const account of (data ?? []) as DuplicateQueryRow[]) {
          if (account.influencer_id === input.exclude_influencer_id ||
              duplicates.some((item) => item.account_id === account.id)) continue;
          duplicates.push({
            account_id: account.id,
            influencer_id: account.influencer_id,
            influencer_name: readInfluencerEmbed(account.influencer)?.display_name ?? "Unknown vendor",
            influencer_document_number: readInfluencerEmbed(account.influencer)?.document_number ?? "",
            platform: account.platform,
            username: account.username ?? account.handle,
            profile_url: account.profile_url,
          });
        }
      }
    }
  }

  if (duplicates.length > 0) {
    return duplicates;
  }

  // Facebook numeric IDs are keyed by normalized_username (id:…). Legacy rows may have
  // normalized_profile_url without ?id=, which would false-match every profile.php URL.
  const numericFacebook = (
    input.platform === "facebook" &&
    input.normalized_username.startsWith("id:")
  );

  if (input.normalized_profile_url && !numericFacebook) {
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
    }

    // Legacy rows may have only a raw URL, or stale/missing normalized fields.
    // Fetch candidates by a literal identity fragment, then parse each URL before
    // declaring a match: tracking params, host aliases, case and trailing slashes
    // must not create another account. Pagination avoids hiding an exact match
    // behind profiles whose names merely contain the same fragment.
    if (duplicates.length === 0 && input.normalized_username) {
      const fragment = input.normalized_username.replace(/^id:/, "").replace(/[\\%_]/g, "\\$&");
      const pageSize = 100;
      for (const column of ["profile_url", "normalized_profile_url"] as const) {
        for (let offset = 0; ; offset += pageSize) {
          let query = supabase.from("influencer_platform_accounts").select(DUPLICATE_SELECT)
            .eq("platform", input.platform).ilike(column, `%${fragment}%`);
          if (input.exclude_account_id) query = query.neq("id", input.exclude_account_id);
          if (input.exclude_influencer_id) query = query.neq("influencer_id", input.exclude_influencer_id);
          const { data, error } = await query.order("id").range(offset, offset + pageSize - 1);
          if (error) throw new Error(error.message);
          for (const account of (data ?? []) as DuplicateQueryRow[]) {
            const parsed = parseProfileInput(account[column] ?? "");
            if (parsed?.platform !== input.platform || parsed.normalized_username !== input.normalized_username ||
                duplicates.some((item) => item.account_id === account.id)) continue;
            duplicates.push({
              account_id: account.id, influencer_id: account.influencer_id,
              influencer_name: readInfluencerEmbed(account.influencer)?.display_name ?? "Unknown vendor",
              influencer_document_number: readInfluencerEmbed(account.influencer)?.document_number ?? "",
              platform: account.platform, username: parsed.username, profile_url: account.profile_url,
            });
          }
          if (duplicates.length > 0 || (data?.length ?? 0) < pageSize) break;
        }
        if (duplicates.length > 0) break;
      }
    }

    return duplicates;
  }
