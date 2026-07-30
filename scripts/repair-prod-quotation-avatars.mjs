/**
 * Production-only avatar repair for known CDN-broken quotation creators.
 *
 * Guarantees:
 * - Targeted allowlist of handles only
 * - Idempotent: skips creators that already have a durable Prod storage avatar
 * - Does not overwrite existing valid durable avatars
 * - Prints a summary: scanned / repaired / skipped / failed
 *
 * Credentials (never printed):
 *   PROD_SUPABASE_URL (optional; defaults to Production ref host)
 *   PROD_SUPABASE_SERVICE_ROLE_KEY  — required
 *   APIFY_TOKEN — required (may come from .env for token only)
 *
 * Usage:
 *   node scripts/repair-prod-quotation-avatars.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync } from "node:fs";

const PROD_REF = "ienowhwfyxoqtzbgltno";

/** Only these creators — QT-2026-0009 CDN-only failures. */
const TARGET_HANDLES = [
  "recipeswithmashael",
  "radwaadeeel",
  "withpassanteto",
  "bytoaatarek",
  "hebaelsopkey",
  "abeer_kittchen",
];

const QUOTATION_SERIAL_PREFIX = "QT-2026-0009";

// APIFY_TOKEN may live in local .env; never load Dev Supabase URL/key into this process.
if (existsSync(".env")) {
  const parsed = config({ path: ".env" });
  void parsed;
  // Re-assert Production credentials win over anything dotenv injected.
  if (process.env.PROD_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
  }
}

const url = (
  process.env.PROD_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  `https://${PROD_REF}.supabase.co`
).trim();
const key = (
  process.env.PROD_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ""
).trim();
const apifyToken = (process.env.APIFY_TOKEN || "").trim();

function isDurableProdStorageUrl(value) {
  const u = (value || "").trim().toLowerCase();
  if (!u) return false;
  if (!u.includes("/storage/") || !u.includes("creator-avatars")) return false;
  // Prefer current Production host; still treat any supabase storage avatar as durable
  // so we never overwrite a working photo with a re-fetch.
  return u.includes("supabase.co/storage/") || u.includes("supabase.in/storage/");
}

function assertProductionTarget() {
  if (!url.includes(PROD_REF)) {
    console.error("Refusing: URL is not Production project", PROD_REF);
    process.exit(1);
  }
  if (!key) {
    console.error("Refusing: Production service role missing in secure env.");
    process.exit(1);
  }
  if (!apifyToken) {
    console.error("Refusing: APIFY_TOKEN missing in secure env.");
    process.exit(1);
  }
  // Never log key / token values — lengths only.
  console.log(
    JSON.stringify({
      target: "production",
      host: new URL(url).hostname,
      serviceRoleConfigured: true,
      apifyConfigured: true,
      handles: TARGET_HANDLES.length,
    })
  );
}

async function fetchApifyPic(handle) {
  const actorId = "apify~instagram-profile-scraper";
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [handle], resultsLimit: 1 }),
    }
  );
  const runJson = await runRes.json();
  const datasetId = runJson.data?.defaultDatasetId;
  if (!datasetId) {
    throw new Error(`Apify run failed (${runRes.status})`);
  }
  const items = await (
    await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=1`
    )
  ).json();
  const row = items[0] || {};
  const pic =
    row.profilePicUrlHD ||
    row.profilePicUrl ||
    row.profile_pic_url_hd ||
    row.profile_pic_url;
  if (typeof pic !== "string" || !pic.startsWith("http")) {
    throw new Error("Apify returned no profile picture");
  }
  return pic;
}

async function uploadAvatar(supabase, influencerId, handle, buffer, contentType) {
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const path = `enrichment/${influencerId}/instagram/${handle}.${ext}`;
  const { error } = await supabase.storage
    .from("creator-avatars")
    .upload(path, buffer, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/creator-avatars/${path}`;
}

async function rewriteQuotationLines(supabase, handle, publicUrl) {
  const { data: items, error } = await supabase
    .from("quotation_items")
    .select("id, handle, profile_image_url, quotations!inner(serial_number)")
    .ilike("quotations.serial_number", `${QUOTATION_SERIAL_PREFIX}%`)
    .ilike("handle", handle);

  if (error) throw new Error(error.message);

  let updated = 0;
  let already = 0;
  for (const item of items ?? []) {
    if (item.profile_image_url === publicUrl) {
      already += 1;
      continue;
    }
    if (
      isDurableProdStorageUrl(item.profile_image_url) &&
      item.profile_image_url !== publicUrl
    ) {
      // Line already points at a different durable avatar — leave it.
      already += 1;
      continue;
    }
    const { error: uerr } = await supabase
      .from("quotation_items")
      .update({ profile_image_url: publicUrl })
      .eq("id", item.id);
    if (!uerr) updated += 1;
  }
  return { updated, already, matched: (items ?? []).length };
}

assertProductionTarget();

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const report = {
  scanned: 0,
  repaired: [],
  skipped: [],
  failed: [],
  beforeAfter: {},
};

for (const handle of TARGET_HANDLES) {
  report.scanned += 1;
  try {
    const { data: accounts, error } = await supabase
      .from("influencer_platform_accounts")
      .select("id, influencer_id, platform, handle, profile_picture_url")
      .ilike("handle", handle)
      .eq("platform", "instagram")
      .limit(1);
    if (error) throw new Error(error.message);
    const account = accounts?.[0];
    if (!account) {
      report.failed.push({ handle, reason: "not_found" });
      console.log(`@${handle}: FAILED not_found`);
      continue;
    }

    const { data: influencer, error: infLookupError } = await supabase
      .from("influencers")
      .select("id, primary_avatar_url")
      .eq("id", account.influencer_id)
      .maybeSingle();
    if (infLookupError) throw new Error(infLookupError.message);

    const primaryUrl =
      influencer?.primary_avatar_url?.trim() ||
      account.profile_picture_url?.trim() ||
      "";
    const before = primaryUrl ? primaryUrl.slice(0, 72) : "(none)";

    if (isDurableProdStorageUrl(primaryUrl)) {
      // Still rewrite quotation lines if they lag behind a durable primary.
      const lines = await rewriteQuotationLines(supabase, handle, primaryUrl);
      report.skipped.push({
        handle,
        reason: "already_durable",
        quotationLinesUpdated: lines.updated,
      });
      report.beforeAfter[handle] = {
        before,
        after: primaryUrl.slice(0, 72),
        status: "skipped_durable",
      };
      console.log(
        `@${handle}: SKIPPED already_durable quotation_lines_updated=${lines.updated}`
      );
      continue;
    }

    const pic = await fetchApifyPic(handle);
    const imgRes = await fetch(pic, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.instagram.com/",
      },
    });
    if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.byteLength < 500) throw new Error("image too small");

    const publicUrl = await uploadAvatar(
      supabase,
      account.influencer_id,
      handle,
      buffer,
      contentType
    );

    const syncedAt = new Date().toISOString();
    const { error: acctErr } = await supabase
      .from("influencer_platform_accounts")
      .update({
        profile_picture_url: publicUrl,
        avatar_source: "uploaded",
        avatar_last_synced_at: syncedAt,
        updated_at: syncedAt,
      })
      .eq("id", account.id);
    if (acctErr) throw new Error(acctErr.message);

    const { error: infErr } = await supabase
      .from("influencers")
      .update({
        primary_avatar_url: publicUrl,
        primary_avatar_source: "uploaded",
        updated_at: syncedAt,
      })
      .eq("id", account.influencer_id);
    if (infErr) throw new Error(infErr.message);

    const lines = await rewriteQuotationLines(supabase, handle, publicUrl);

    report.repaired.push({
      handle,
      quotationLinesUpdated: lines.updated,
      durableHost: new URL(publicUrl).hostname,
    });
    report.beforeAfter[handle] = {
      before,
      after: publicUrl.slice(0, 72),
      status: "repaired",
    };
    console.log(
      `@${handle}: REPAIRED quotation_lines_updated=${lines.updated} host=${new URL(publicUrl).hostname}`
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    report.failed.push({ handle, reason });
    console.log(`@${handle}: FAILED ${reason}`);
  }
}

console.log("\n=== REPAIR SUMMARY ===");
console.log(
  JSON.stringify(
    {
      scanned: report.scanned,
      repaired: report.repaired.length,
      skipped: report.skipped.length,
      failed: report.failed.length,
      unresolved: report.failed.length,
      repairedHandles: report.repaired.map((r) => r.handle),
      skippedHandles: report.skipped.map((r) => `${r.handle}:${r.reason}`),
      failedHandles: report.failed.map((r) => `${r.handle}:${r.reason}`),
      recipeswithmashael: report.beforeAfter.recipeswithmashael ?? null,
    },
    null,
    2
  )
);

if (report.failed.length > 0) process.exitCode = 2;
