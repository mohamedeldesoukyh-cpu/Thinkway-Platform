import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { isDurableStoredAvatarUrl } from "@/lib/creators/dna-avatar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
/** Apify avatar refresh can take ~60s per creator. */
export const maxDuration = 300;

type Body = {
  handles?: string[];
  /** When set, rewrite quotation_items.profile_image_url for matching serials. */
  quotationSerialPrefix?: string;
};

/**
 * Admin: re-fetch creator photos (CDN → Apify) into creator-avatars storage
 * and optionally rewrite quotation line snapshots.
 *
 * Idempotent: skips influencers that already have a durable storage avatar.
 * Does not overwrite existing durable primaries.
 *
 * POST { handles: string[], quotationSerialPrefix?: "QT-2026-0009" }
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "discovery.write");
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "Unauthorized" ? 401 : 403 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const handles = [
    ...new Set(
      (body.handles ?? [])
        .map((h) => h.replace(/^@+/, "").trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (handles.length === 0) {
    return NextResponse.json(
      { error: "handles must be a non-empty string array." },
      { status: 400 }
    );
  }
  if (handles.length > 40) {
    return NextResponse.json(
      { error: "At most 40 handles per request." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { repairCreatorAvatarDurably } = await import(
    "@/lib/creators/stabilize-creator-avatar"
  );

  const repaired: Array<{ handle: string; urlHost: string }> = [];
  const skipped: Array<{ handle: string; reason: string }> = [];
  const failed: Array<{ handle: string; reason: string }> = [];

  for (const handle of handles) {
    const { data: accounts, error } = await admin
      .from("influencer_platform_accounts")
      .select("influencer_id, platform, handle")
      .ilike("handle", handle)
      .limit(1);

    if (error || !accounts?.[0]) {
      failed.push({ handle, reason: error?.message ?? "not_found" });
      continue;
    }

    const account = accounts[0];
    const { data: influencer } = await admin
      .from("influencers")
      .select("primary_avatar_url")
      .eq("id", account.influencer_id)
      .maybeSingle();
    const primary = influencer?.primary_avatar_url ?? null;

    if (primary && isDurableStoredAvatarUrl(primary)) {
      skipped.push({ handle, reason: "already_durable" });
      continue;
    }

    const result = await repairCreatorAvatarDurably(admin, account.influencer_id, {
      preferredHandle: handle,
      preferredPlatform: account.platform,
      forceRefresh: true,
      allowApifyFallback: true,
    });

    if (!result.ok || !result.url) {
      failed.push({ handle, reason: result.reason ?? "repair_failed" });
      continue;
    }

    repaired.push({ handle, urlHost: new URL(result.url).hostname });

    const serialPrefix = body.quotationSerialPrefix?.trim();
    if (serialPrefix) {
      const { data: items } = await admin
        .from("quotation_items")
        .select("id, handle, profile_image_url, quotations!inner(serial_number)")
        .ilike("quotations.serial_number", `${serialPrefix}%`)
        .ilike("handle", handle);

      for (const item of items ?? []) {
        if (item.profile_image_url === result.url) continue;
        if (
          item.profile_image_url &&
          isDurableStoredAvatarUrl(item.profile_image_url) &&
          item.profile_image_url !== result.url
        ) {
          continue;
        }
        await admin
          .from("quotation_items")
          .update({ profile_image_url: result.url } as never)
          .eq("id", item.id);
      }
    }
  }

  return NextResponse.json(
    {
      scanned: handles.length,
      repaired: repaired.length,
      skipped: skipped.length,
      failed: failed.length,
      unresolved: failed.length,
      repairedHandles: repaired,
      skippedHandles: skipped,
      failedHandles: failed,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
