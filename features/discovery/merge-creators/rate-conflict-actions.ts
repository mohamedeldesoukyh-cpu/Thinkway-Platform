"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions-server";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { findMergeRateConflicts, type MergeRateRow } from "@/lib/discovery/merge-rate-conflicts";

const pairSchema = z.object({ targetInfluencerId: z.uuid(), sourceInfluencerId: z.uuid() }).refine(value => value.targetInfluencerId !== value.sourceInfluencerId);
async function authorize(edit: boolean) {
  const db = await createSupabaseServerClient();
  const discovery = await requirePermission(db, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in discovery) throw new Error(discovery.error);
  const rates = await requirePermission(db, edit ? "rate_cards.edit" : "rate_cards.read");
  if ("error" in rates) throw new Error(rates.error);
  return { db, actorId: discovery.userId };
}

export async function getMergeRateConflictsAction(raw: { targetInfluencerId: string; sourceInfluencerId: string }) {
  const input = pairSchema.parse(raw);
  const { db } = await authorize(false);
  const rows: MergeRateRow[] = [];
  for (let from = 0; ; from += 500) {
    const result = await db.from("rate_card_lines").select("*").in("influencer_id", [input.targetInfluencerId, input.sourceInfluencerId]).order("id").range(from, from + 499);
    if (result.error) throw new Error(result.error.message);
    const page = result.data as unknown as MergeRateRow[];
    rows.push(...page);
    if (page.length < 500) break;
  }
  const conflicts = findMergeRateConflicts(rows, input.targetInfluencerId, input.sourceInfluencerId);
  const ids = [...new Set(conflicts.map(row => row.target.version_id))];
  const titles = new Map<string, string>();
  for (let from = 0; from < ids.length; from += 100) {
    const result = await db.from("rate_card_register").select("id,name,version").in("id", ids.slice(from, from + 100));
    if (result.error) throw new Error(result.error.message);
    for (const row of (result.data ?? []) as { id: string; name: string; version: string }[]) titles.set(row.id, `${row.name} · ${row.version}`);
  }
  return conflicts.map(row => ({ ...row, title: titles.get(row.target.version_id) ?? "Rate card" }));
}

export async function resolveMergeRateConflictsAction(raw: {
  targetInfluencerId: string; sourceInfluencerId: string;
  choices: { keep: MergeRateRow; remove: MergeRateRow }[];
}) {
  const input = pairSchema.parse(raw);
  const choices = z.array(z.object({ keep: z.record(z.string(), z.unknown()), remove: z.record(z.string(), z.unknown()) })).min(1).max(5000).parse(raw.choices);
  const { actorId } = await authorize(true);
  const result = await createSupabaseAdminClient().rpc("resolve_creator_merge_rates" as never, {
    p_target: input.targetInfluencerId, p_source: input.sourceInfluencerId,
    p_actor: actorId, p_choices: choices,
  } as never);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/rate-cards");
}
