"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { CUSTOM_REPORTS_PREFERENCE_KEY, readSavedCustomReports, savedCustomReportSchema, type SavedCustomReport } from "@/lib/reports/custom/saved-custom-reports";

async function actor() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "analytics.read");
  if ("error" in auth) throw new Error(auth.error);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in again.");
  return { supabase, reports: readSavedCustomReports(data.user.user_metadata[CUSTOM_REPORTS_PREFERENCE_KEY]) };
}
type Result = { ok: true; reports: SavedCustomReport[] } | { ok: false; message: string };
export async function loadSavedCustomReports(): Promise<Result> {
  try { const { reports } = await actor(); return { ok: true, reports }; }
  catch { return { ok: false, message: "Could not load saved reports. Please retry." }; }
}
export async function saveCustomReport(input: unknown): Promise<Result> {
  try {
    const report = savedCustomReportSchema.parse(input);
    const { supabase, reports } = await actor();
    const updated = reports.some(r => r.id === report.id) ? reports.map(r => r.id === report.id ? report : r) : [...reports, report];
    if (updated.length > 30) return { ok: false, message: "You can save up to 30 custom reports." };
    const { error } = await supabase.auth.updateUser({ data: { [CUSTOM_REPORTS_PREFERENCE_KEY]: updated } });
    if (error) throw error;
    return { ok: true, reports: updated };
  } catch { return { ok: false, message: "Could not save the report. Check its name and selection, then retry." }; }
}
