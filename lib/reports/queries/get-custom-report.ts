import { pickCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { parseLineAssignment } from "@/lib/campaigns/line-assignment";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOverviewReportInput, readRows } from "./get-overview-report";
import { buildCustomReport, type CustomCurrency } from "../custom/custom-report";

export async function getCustomReport(params: Record<string, string | string[] | undefined>, currency: CustomCurrency, client?: SupabaseClient) {
  const supabase = client ?? await createSupabaseServerClient();
  const input = await loadOverviewReportInput({ ...params, currency: currency === "Foreign" ? "EGP" : currency }, supabase);
  const assignments = await readRows(supabase.from("campaign_influencers").select("id, campaign_line_id, influencer_id, status, influencer:influencers(display_name, document_number)").order("id"));
  const names = new Map<string, { value: string; label: string; code?: string | null }[]>();
  for (const assignment of assignments) {
    if (assignment.status === "cancelled" || !assignment.campaign_line_id) continue;
    const creator = Array.isArray(assignment.influencer) ? assignment.influencer[0] : assignment.influencer;
    if (creator?.display_name && assignment.influencer_id) names.set(assignment.campaign_line_id, [...names.get(assignment.campaign_line_id) ?? [], { value: assignment.influencer_id, label: creator.display_name, code: creator.document_number }]);
  }
  const assignedIds = [...new Set([...assignments.flatMap(a => a.influencer_id ? [a.influencer_id] : []), ...input.lines.flatMap(line => { const a = parseLineAssignment(line.metadata); return a ? [a.influencer_id] : []; })])];
  const identities = new Map<string, { value: string; label: string; code: string; username: string }>();
  for (let offset = 0; offset < assignedIds.length; offset += 200) {
    const ids = assignedIds.slice(offset, offset + 200);
    const [creators, accounts] = await Promise.all([
      readRows(supabase.from("influencers").select("id, document_number, display_name").in("id", ids).order("id")),
      readRows(supabase.from("influencer_platform_accounts").select("id, influencer_id, profile_display_name, handle, username, is_primary").in("influencer_id", ids).order("id")),
    ]);
    creators.forEach(c => {
      const profiles = accounts.filter(a => a.influencer_id === c.id).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
      const handle = profiles.map(a => a.handle || a.username).find(Boolean) || (c.display_name.startsWith("@") ? c.display_name : "");
      identities.set(c.id, { value: c.id, code: c.document_number, label: pickCreatorDisplayName([...profiles.map(a => a.profile_display_name), c.display_name], handle), username: handle ? "@" + handle.replace(/^@+/, "") : "" });
    });
  }
  const recordCurrency = typeof params.recordCurrency === "string" ? params.recordCurrency : "";
  return buildCustomReport({ ...input, lines: input.lines.map(line => { const assignment = parseLineAssignment(line.metadata); const creators = assignment ? [{ value: assignment.influencer_id, label: assignment.influencer_name, code: identities.get(assignment.influencer_id)?.code }] : [...new Map((names.get(line.id) ?? []).map(c => [c.value, c])).values()]; const resolved = creators.map(c => identities.get(c.value) ?? c); return { ...line, creators: resolved, creatorNames: resolved.map(c => c.label) }; }) }, currency, recordCurrency, typeof params.creatorId === "string" ? params.creatorId : "", typeof params.columns === "string" && params.columns.split(",").includes("creator"));
}

