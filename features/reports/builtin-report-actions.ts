"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { builtinReportSchema, canSeeBuiltinReport, type BuiltinReportSettings } from "@/lib/reports/builtin-report-settings";
export async function loadBuiltinReportSettings() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "analytics.read");
  if ("error" in auth) throw new Error(auth.error);
  const { data, error } = await supabase.from("builtin_report_settings").select("*");
  if (error) throw error;
  const admin = auth.roleSlug === "admin" || auth.roleSlug === "super_admin";
  return { settings: data as BuiltinReportSettings[], hiddenIds: data.filter(r => !canSeeBuiltinReport(r as BuiltinReportSettings, auth.userId, admin)).map(r => r.id), admin };
}
export async function saveBuiltinReportSettings(input: unknown) {
  try {
    const report = builtinReportSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const auth = await requirePermission(supabase, "analytics.read");
    if ("error" in auth || !["admin", "super_admin"].includes(auth.roleSlug ?? "")) return { ok: false, message: "Only administrators can change built-in reports." };
    const { error } = await supabase.from("builtin_report_settings").upsert({ ...report, shared_with: report.visibility === "users" ? report.shared_with : [], updated_at: new Date().toISOString() });
    if (error) throw error;
    return { ok: true, message: "Report settings saved." };
  } catch { return { ok: false, message: "Could not save settings. Check the name and selected users." }; }
}
