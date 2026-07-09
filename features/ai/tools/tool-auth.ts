import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ToolAuthContext = {
  supabase: SupabaseClient;
  userId: string;
};

type ToolAuthScope = ToolAuthContext | null;

let activeToolAuthScope: ToolAuthScope = null;

/**
 * Inject the authenticated Supabase client from the API route / server action
 * so tool executors reuse the same session (avoids empty RLS results in SSE streams).
 */
export function runWithToolAuthContext<T>(
  context: ToolAuthContext,
  fn: () => Promise<T>
): Promise<T> {
  const previous = activeToolAuthScope;
  activeToolAuthScope = context;
  return fn().finally(() => {
    activeToolAuthScope = previous;
  });
}

export async function requireToolAuthContext(): Promise<ToolAuthContext> {
  if (activeToolAuthScope) {
    return activeToolAuthScope;
  }

  const supabase = await createSupabaseServerClient();
  const { user, error } = await getRequestAuth();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to use AI tools.");
  }

  return { supabase, userId: user.id };
}
