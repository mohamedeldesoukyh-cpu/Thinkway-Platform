"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createGroupSchema } from "./schemas";

export type CreateGroupFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  groupId?: string;
};

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  return value.trim();
}

export async function createGroupAction(
  _prev: CreateGroupFormState,
  formData: FormData
): Promise<CreateGroupFormState> {
  const parsed = createGroupSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, message: authError?.message ?? "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: parsed.data.name,
      status: parsed.data.status,
      notes: emptyToNull(parsed.data.notes),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/groups");
  revalidatePath("/clients");

  return {
    ok: true,
    message: "Group created.",
    groupId: data.id,
  };
}
