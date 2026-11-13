import { parseLineAssignment } from "@/lib/campaigns/line-assignment";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadOverviewReportInput, readRows } from "./get-overview-report";
import { buildCustomReport, type CustomCurrency } from "../custom/custom-report";

export async function getCustomReport(params: Record<string, string | string[] | undefined>, currency: CustomCurrency, client?: SupabaseClient) {
  const supabase = client ?? await createSupabaseServerClient();
  const input = await loadOverviewReportInput({ ...params, currency: currency === "Foreign" ? "EGP" : currency }, supabase);
  const assignments = await readRows(supabase.from("campaign_influencers").select("id, campaign_line_id, influencer_id, status, influencer:influencers(display_name)").order("id"));
  const names = new Map<string, { value: string; label: string }[]>();
  for (const assignment of assignments) {
    if (assignment.status === "cancelled" || !assignment.campaign_line_id) continue;
    const creator = Array.isArray(assignment.influencer) ? assignment.influencer[0] : assignment.influencer;
    if (creator?.display_name && assignment.influencer_id) names.set(assignment.campaign_line_id, [...names.get(assignment.campaign_line_id) ?? [], { value: assignment.influencer_id, label: creator.display_name }]);
  }
  const recordCurrency = typeof params.recordCurrency === "string" ? params.recordCurrency : "";
  return buildCustomReport({ ...input, lines: input.lines.map(line => { const assignment = parseLineAssignment(line.metadata); const creators = assignment ? [{ value: assignment.influencer_id, label: assignment.influencer_name }] : [...new Map((names.get(line.id) ?? []).map(c => [c.value, c])).values()]; return { ...line, creators, creatorNames: creators.map(c => c.label) }; }) }, currency, recordCurrency, typeof params.creatorId === "string" ? params.creatorId : "", typeof params.columns === "string" && params.columns.split(",").includes("creator"));
}

