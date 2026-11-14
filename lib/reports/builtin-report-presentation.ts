import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const getBuiltinReportPresentation = cache(async (id: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("builtin_report_settings").select("name,description").eq("id",id).maybeSingle();
  if (error) throw error;
  return data;
});
