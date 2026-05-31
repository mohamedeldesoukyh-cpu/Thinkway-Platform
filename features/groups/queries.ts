import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GroupRow } from "@/types/database";

export const GROUPS_PAGE_SIZE = 10;

export async function getGroupsList(params: {
  page?: number;
  search?: string;
}): Promise<{
  groups: GroupRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * GROUPS_PAGE_SIZE;
  const to = from + GROUPS_PAGE_SIZE - 1;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Unauthorized");
  }

  let query = supabase
    .from("groups")
    .select("*", { count: "exact" })
    .order("name");

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;

  return {
    groups: (data ?? []) as GroupRow[],
    total,
    page,
    pageSize: GROUPS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / GROUPS_PAGE_SIZE)),
  };
}
