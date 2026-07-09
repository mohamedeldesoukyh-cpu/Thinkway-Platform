import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import {
  parseCreatorAvatarStoragePathFromUrl,
  uploadEnrichmentCreatorAvatar,
  uploadedAvatarExistsInStorage,
} from "@/lib/discovery-import/import-avatar-storage";
import { fetchImageBuffer } from "@/lib/creators/publication-preview-proxy";
import { isDisplayableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import type { Database } from "@/types/database";

export type StabilizeCreatorAvatarResult = {
  influencerId: string;
  handle: string;
  ok: boolean;
  url?: string;
  reason?: string;
};

async function fetchAvatarBytes(input: {
  src?: string | null;
  profileUrl?: string | null;
}): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const src = input.src?.trim() || null;
  const profileUrl = input.profileUrl?.trim() || null;

  if (src) {
    const direct = await fetchImageBuffer(src);
    if (direct.ok) {
      return { buffer: direct.buffer, contentType: direct.contentType };
    }
  }

  const proxied = await fetchCreatorAvatarImage({ src, profileUrl });
  if (proxied.ok) {
    return { buffer: proxied.buffer, contentType: proxied.contentType };
  }

  return null;
}

/**
 * Copy an existing avatar URL (CDN, DNA, or storage) into creator-avatars storage
 * and set it as the stable primary — no Apify enrichment.
 */
export async function stabilizeCreatorAvatar(
  supabase: SupabaseClient<Database>,
  influencerId: string,
  options?: {
    preferredHandle?: string;
    preferredPlatform?: string;
    /** Skip durable storage candidates and re-fetch from profile/CDN sources. */
    forceRefresh?: boolean;
  }
): Promise<StabilizeCreatorAvatarResult> {
  const [{ data: inf }, { data: accounts }] = await Promise.all([
    supabase
      .from("influencers")
      .select("id, display_name, primary_avatar_url, primary_avatar_source")
      .eq("id", influencerId)
      .maybeSingle(),
    supabase
      .from("influencer_platform_accounts")
      .select("id, platform, handle, profile_url, profile_picture_url, is_primary")
      .eq("influencer_id", influencerId),
  ]);

  if (!inf) {
    return {
      influencerId,
      handle: options?.preferredHandle ?? influencerId,
      ok: false,
      reason: "influencer_not_found",
    };
  }

  const platformAccounts = accounts ?? [];
  const primaryAccount =
    platformAccounts.find((a) => a.is_primary) ??
    platformAccounts.find(
      (a) =>
        options?.preferredPlatform &&
        a.platform.toLowerCase() === options.preferredPlatform.toLowerCase()
    ) ??
    platformAccounts.find((a) => a.profile_picture_url) ??
    platformAccounts[0];

  const handle =
    options?.preferredHandle ??
    primaryAccount?.handle?.replace(/^@/, "") ??
    inf.display_name?.replace(/\s+/g, "").toLowerCase() ??
    influencerId;

  const platform = options?.preferredPlatform ?? primaryAccount?.platform ?? "instagram";
  const profileUrl =
    primaryAccount?.profile_url ??
    (primaryAccount?.handle
      ? `https://www.instagram.com/${primaryAccount.handle.replace(/^@/, "")}/`
      : null);

  const candidateUrls = [
    inf.primary_avatar_url,
    primaryAccount?.profile_picture_url,
    ...platformAccounts.map((a) => a.profile_picture_url),
  ].filter((url): url is string => Boolean(url?.trim()));

  if (!options?.forceRefresh) {
    for (const url of candidateUrls) {
      if (parseCreatorAvatarStoragePathFromUrl(url)) {
        const exists = await uploadedAvatarExistsInStorage(supabase, url);
        if (exists && isDisplayableAvatarUrl(url)) {
          if (url !== inf.primary_avatar_url) {
            await supabase
              .from("influencers")
              .update({
                primary_avatar_url: url,
                primary_avatar_source: "uploaded",
              } as never)
              .eq("id", influencerId);
          }
          await persistCreatorPrimaryIdentity(supabase, influencerId);
          return { influencerId, handle, ok: true, url };
        }
      }
    }
  }

  const fetchOrder = options?.forceRefresh
    ? [...candidateUrls.filter((url) => !parseCreatorAvatarStoragePathFromUrl(url)), ...candidateUrls]
    : candidateUrls;

  for (const src of [...new Set(fetchOrder)]) {
    if (options?.forceRefresh && parseCreatorAvatarStoragePathFromUrl(src)) {
      continue;
    }
    const fetched = await fetchAvatarBytes({ src, profileUrl });
    if (!fetched) continue;

    try {
      const publicUrl = await uploadEnrichmentCreatorAvatar({
        supabase,
        influencerId,
        platform,
        username: handle,
        buffer: Buffer.from(fetched.buffer),
        contentType: fetched.contentType,
      });

      const syncedAt = new Date().toISOString();
      if (primaryAccount?.id) {
        await supabase
          .from("influencer_platform_accounts")
          .update({
            profile_picture_url: publicUrl,
            avatar_source: "uploaded",
            avatar_last_synced_at: syncedAt,
            updated_at: syncedAt,
          } as never)
          .eq("id", primaryAccount.id);
      }

      await supabase
        .from("influencers")
        .update({
          primary_avatar_url: publicUrl,
          primary_avatar_source: "uploaded",
        } as never)
        .eq("id", influencerId);

      await persistCreatorPrimaryIdentity(supabase, influencerId);
      return { influencerId, handle, ok: true, url: publicUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { influencerId, handle, ok: false, reason: message };
    }
  }

  if (profileUrl) {
    const fetched = await fetchAvatarBytes({ profileUrl });
    if (fetched) {
      try {
        const publicUrl = await uploadEnrichmentCreatorAvatar({
          supabase,
          influencerId,
          platform,
          username: handle,
          buffer: Buffer.from(fetched.buffer),
          contentType: fetched.contentType,
        });
        const syncedAt = new Date().toISOString();
        if (primaryAccount?.id) {
          await supabase
            .from("influencer_platform_accounts")
            .update({
              profile_picture_url: publicUrl,
              avatar_source: "uploaded",
              avatar_last_synced_at: syncedAt,
              updated_at: syncedAt,
            } as never)
            .eq("id", primaryAccount.id);
        }
        await supabase
          .from("influencers")
          .update({
            primary_avatar_url: publicUrl,
            primary_avatar_source: "uploaded",
          } as never)
          .eq("id", influencerId);
        await persistCreatorPrimaryIdentity(supabase, influencerId);
        return { influencerId, handle, ok: true, url: publicUrl };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { influencerId, handle, ok: false, reason: message };
      }
    }
  }

  return {
    influencerId,
    handle,
    ok: false,
    reason: "no_fetchable_avatar_source",
  };
}

export async function stabilizeCreatorsByHandles(
  supabase: SupabaseClient<Database>,
  handles: string[],
  options?: { forceRefresh?: boolean }
): Promise<StabilizeCreatorAvatarResult[]> {
  const results: StabilizeCreatorAvatarResult[] = [];

  for (const handle of handles) {
    const { data: accounts } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, platform, handle")
      .ilike("handle", handle);

    const influencerIds = [...new Set((accounts ?? []).map((a) => a.influencer_id))];
    if (influencerIds.length === 0) {
      results.push({
        influencerId: handle,
        handle,
        ok: false,
        reason: "not_found",
      });
      continue;
    }

    for (const influencerId of influencerIds) {
      const account = (accounts ?? []).find((a) => a.influencer_id === influencerId);
      results.push(
        await stabilizeCreatorAvatar(supabase, influencerId, {
          preferredHandle: handle,
          preferredPlatform: account?.platform,
          forceRefresh: options?.forceRefresh,
        })
      );
    }
  }

  return results;
}
