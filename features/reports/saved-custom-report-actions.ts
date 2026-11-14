"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { INTERNAL_ROLE_SLUGS } from "@/features/settings/constants";
import { CUSTOM_REPORTS_PREFERENCE_KEY, readSavedCustomReports, reportVisibilitySchema, savedCustomReportSchema, type SavedCustomReport } from "@/lib/reports/custom/saved-custom-reports";

async function actor() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "analytics.read");
  if ("error" in auth) throw new Error(auth.error);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in again.");
  const admin = auth.roleSlug === "admin" || auth.roleSlug === "super_admin";
  // Idempotent import: never overwrite edits or a user's later favorite choice.
  const legacy = readSavedCustomReports(data.user.user_metadata[CUSTOM_REPORTS_PREFERENCE_KEY]);
  if (legacy.length) {
    const result = await supabase.from("saved_report_templates").upsert(legacy.map(r => ({ id: r.id, owner_id: auth.userId, name: r.name, configuration: { columns: r.columns, currency: r.currency, includeVat: r.includeVat, filters: r.filters } })), { onConflict: "id", ignoreDuplicates: true });
    if (result.error) throw result.error;
    const favorites = await supabase.from("saved_report_favorites").upsert(legacy.map(r => ({ user_id: auth.userId, report_id: r.id, favorite: r.favorite })), { onConflict: "user_id,report_id", ignoreDuplicates: true });
    if (favorites.error) throw favorites.error;
  }
  return { supabase, userId: auth.userId, admin };
}
type Result = { ok: true; reports: SavedCustomReport[] } | { ok: false; message: string };
export async function loadSavedCustomReports(): Promise<Result> {
  try {
    const { supabase, userId, admin } = await actor();
    const [rows, favorites] = await Promise.all([supabase.from("saved_report_templates").select("*").order("name"), supabase.from("saved_report_favorites").select("report_id,favorite").eq("user_id", userId)]);
    if (rows.error || favorites.error) throw rows.error || favorites.error;
    const stars = new Set(favorites.data.filter(r => r.favorite).map(r => r.report_id));
    const reports = rows.data.flatMap(row => {
      const parsed = savedCustomReportSchema.safeParse({ ...(row.configuration as object), id: row.id, name: row.name, favorite: stars.has(row.id) });
      return parsed.success ? [{ ...parsed.data, ownerId: row.owner_id, visibility: reportVisibilitySchema.parse(row.visibility), sharedWith: row.shared_with, canEdit: admin || row.owner_id === userId }] : [];
    });
    return { ok: true, reports };
  } catch { return { ok: false, message: "Could not load saved reports. Please retry." }; }
}
const inputSchema = savedCustomReportSchema.extend({ visibility: reportVisibilitySchema.default("private"), sharedWith: z.array(z.string().uuid()).max(300).default([]) });
export async function saveCustomReport(input: unknown): Promise<Result> {
  try {
    const report = inputSchema.parse(input);
    if (report.visibility === "users" && !report.sharedWith.length) return { ok: false, message: "Choose at least one user." };
    const { supabase, userId, admin } = await actor();
    const existing = await supabase.from("saved_report_templates").select("owner_id").eq("id", report.id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && existing.data.owner_id !== userId && !admin) return { ok: false, message: "Only the report owner or an administrator can edit this report. Save a copy instead." };
    const values = { name: report.name, configuration: { columns: report.columns, currency: report.currency, includeVat: report.includeVat, filters: report.filters }, visibility: report.visibility, shared_with: report.visibility === "users" ? [...new Set(report.sharedWith)] : [], updated_at: new Date().toISOString() };
    const result = existing.data ? await supabase.from("saved_report_templates").update(values).eq("id", report.id).select("id").single() : await supabase.from("saved_report_templates").insert({ ...values, id: report.id, owner_id: userId }).select("id").single();
    if (result.error) throw result.error;
    const star = await supabase.from("saved_report_favorites").upsert({ user_id: userId, report_id: report.id, favorite: report.favorite });
    if (star.error) throw star.error;
    return loadSavedCustomReports();
  } catch { return { ok: false, message: "Could not save the report. Check its name and selection, then retry." }; }
}
export async function setCustomReportFavorite(id: string, favorite: boolean): Promise<Result> {
  try {
    z.string().uuid().parse(id); z.boolean().parse(favorite);
    const { supabase, userId } = await actor();
    const { error } = await supabase.from("saved_report_favorites").upsert({ user_id: userId, report_id: id, favorite });
    if (error) throw error;
    return loadSavedCustomReports();
  } catch { return { ok: false, message: "Could not update favorite. Please retry." }; }
}
export async function loadReportUsers(): Promise<{ ok: true; users: { id: string; name: string }[]; admin: boolean } | { ok: false; message: string }> {
  try {
    const { supabase, admin } = await actor();
    const { data, error } = await supabase.from("profiles").select("id,full_name,email,role:roles(slug)").eq("is_active", true).order("full_name");
    if (error) throw error;
    const users = (data as unknown as {id:string;full_name:string|null;email:string;role:{slug:string}|null}[]).filter(r => r.role && INTERNAL_ROLE_SLUGS.has(r.role.slug)).map(r => ({ id:r.id, name:r.full_name || r.email }));
    return { ok: true, users, admin };
  } catch { return { ok: false, message: "Could not load users. Please retry." }; }
}
