#!/usr/bin/env node
import "@/lib/performance/script-env-preload";

import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { extractDnaAvatarUrl } from "@/lib/creators/dna-avatar";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { restoreInfluencerAvatarsFromDna } from "@/lib/creators/restore-avatar-from-dna";
import {
  createScriptSupabase,
  requireScriptEnvVars,
} from "@/lib/performance/script-env";

const handles = process.argv.slice(2);
if (handles.length === 0) {
  handles.push(
    "zeinaelfakahany",
    "mayanelsayed",
    "jana.hassan__",
    "rowanabadry__",
    "omneya_abdelmoneim"
  );
}

async function main() {
  requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const supabase = createScriptSupabase();
  const influencerIds = new Set<string>();

  for (const handle of handles) {
    const { data: accounts, error } = await supabase
      .from("influencer_platform_accounts")
      .select(
        "id, influencer_id, platform, handle, profile_picture_url, avatar_source, metadata"
      )
      .ilike("handle", handle);

    if (error) throw new Error(error.message);

    const ids = [...new Set((accounts ?? []).map((a) => a.influencer_id))];
    if (ids.length === 0) {
      console.log(`--- @${handle} NOT FOUND`);
      continue;
    }

    for (const infId of ids) {
      influencerIds.add(infId);
      const [{ data: inf }, { data: dna }, { data: iplRowsData }] = await Promise.all([
        supabase
          .from("influencers")
          .select("id, display_name, primary_avatar_url, primary_avatar_source, metadata")
          .eq("id", infId)
          .maybeSingle(),
        supabase
          .from("creator_dna")
          .select("influencer_id, document")
          .eq("influencer_id", infId)
          .maybeSingle(),
        supabase
          .from("ipl_snapshots")
          .select("id, raw_payload, created_at")
          .eq("influencer_id", infId)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const dnaAvatar = dna
        ? extractDnaAvatarUrl(parseCreatorDNADocument(dna.document))
        : null;
      const iplAvatar = extractIplAvatar(iplRowsData);
      const accts = (accounts ?? []).filter((a) => a.influencer_id === infId);

      console.log(`--- @${handle} | ${inf?.display_name ?? "?"}`);
      console.log(`  influencer_id: ${infId}`);
      console.log(`  primary_avatar_url: ${inf?.primary_avatar_url ?? "null"}`);
      console.log(`  primary_avatar_source: ${inf?.primary_avatar_source ?? "null"}`);
      console.log(`  dna avatar: ${dnaAvatar ?? "null"}`);
      console.log(
        `  metadata.avatar_url: ${metaAvatar(inf?.metadata as Record<string, unknown> | null) ?? "null"}`
      );
      console.log(`  ipl avatar: ${iplAvatar ?? "null"}`);
      for (const a of accts) {
        const meta = a.metadata as Record<string, unknown> | null;
        console.log(
          `  ${a.platform} @${a.handle} pic=${short(a.profile_picture_url)} src=${a.avatar_source} meta=${short(metaAvatar(meta))}`
        );
      }
    }
  }

  const ids = [...influencerIds];
  if (ids.length === 0) return;

  console.log("\n=== restore from DNA ===");
  console.log(await restoreInfluencerAvatarsFromDna(supabase, ids));

  console.log("\n=== persist primary identity ===");
  for (const id of ids) {
    const result = await persistCreatorPrimaryIdentity(supabase, id);
    console.log(`${id} -> ${result.primaryAvatarUrl ?? "null"}`);
  }
}

function short(value: string | null | undefined): string {
  if (!value) return "null";
  return value.length > 90 ? `${value.slice(0, 90)}…` : value;
}

function metaAvatar(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  for (const key of ["avatar_url", "profile_image_url", "imported_avatar"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractIplAvatar(
  rows: Array<{ raw_payload: unknown }> | null | undefined
): string | null {
  const payload = rows?.[0]?.raw_payload;
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const profile = p.profile as Record<string, unknown> | undefined;
  const author = p.author as Record<string, unknown> | undefined;
  for (const candidate of [
    profile?.profilePicUrl,
    profile?.profile_pic_url,
    author?.profilePicUrl,
    author?.profile_pic_url,
    p.profilePicUrl,
    p.profile_pic_url,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
