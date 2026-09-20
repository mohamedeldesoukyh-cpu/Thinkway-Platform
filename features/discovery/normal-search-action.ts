"use server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readContinuationSecret, runContinuedNormalSearch } from "@/lib/discovery/normal-search-continuation";
import { NORMAL_SEARCH_SORTS, sanitizeNormalFilters, type NormalSearchRequest } from "@/lib/discovery/normal-search";
import { DEFAULT_CREATOR_SEARCH_FILTERS } from "./components/creator-search/creator-search-types";

export async function searchNormalDiscoveryAction(input: NormalSearchRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const shape = Object.fromEntries(Object.entries(DEFAULT_CREATOR_SEARCH_FILTERS).map(([key,value]) => [key,
    key === "followerRanges" ? z.array(z.object({ min: z.string().max(20), max: z.string().max(20) })).max(20)
      : Array.isArray(value) ? z.array(z.string().max(300)).max(30)
      : typeof value === "boolean" ? z.boolean() : z.string().max(500)]));
  const filters = z.object(shape).parse(input.filters) as unknown as NormalSearchRequest["filters"];
  const request = { filters: sanitizeNormalFilters(filters), sort: z.object({ field: z.enum(NORMAL_SEARCH_SORTS), direction: z.enum(["asc","desc"]) }).parse(input.sort), page: z.number().int().min(1).max(100).parse(input.page), pageSize: z.number().int().min(1).max(100).parse(input.pageSize) };
  const continuation = z.string().max(750_000).optional().parse(input.continuation);
  const context = JSON.stringify([user.id, user.role, user.app_metadata, process.env.NEXT_PUBLIC_SUPABASE_URL]);
  return runContinuedNormalSearch(supabase, { ...request, continuation }, context, readContinuationSecret());
}
