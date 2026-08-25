"use server";

import { revalidatePath } from "next/cache";

import { parseEntityLogoKind, type EntityLogoKind } from "@/lib/entity-logos/identity-logo";
import { clearEntityLogoFile, uploadEntityLogoFile } from "@/lib/entity-logos/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EntityLogoActionState = {
  ok: boolean;
  message?: string;
  logoUrl?: string | null;
};

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

function revalidateEntityLogoPaths(kind: EntityLogoKind, entityId: string) {
  if (kind === "group") {
    revalidatePath("/groups");
    revalidatePath(`/groups/${entityId}`);
    revalidatePath("/client-portal", "layout");
    return;
  }
  if (kind === "client") {
    revalidatePath("/clients");
    revalidatePath(`/clients/${entityId}`);
    revalidatePath("/client-portal", "layout");
    return;
  }
  revalidatePath("/brands");
  revalidatePath(`/brands`);
  revalidatePath("/clients");
  revalidatePath("/groups");
}

export async function uploadEntityLogoAction(formData: FormData): Promise<EntityLogoActionState> {
  const kind = parseEntityLogoKind(formData.get("kind"));
  const entityId = String(formData.get("entity_id") ?? "").trim();
  const file = formData.get("file");
  if (!kind || !entityId) {
    return { ok: false, message: "Choose a group, client, or brand first." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a logo image." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) return { ok: false, message: authError };

  const table = kind === "group" ? "groups" : kind === "client" ? "clients" : "brands";
  const { data: current, error: currentError } = await supabase
    .from(table)
    .select("id, logo_url")
    .eq("id", entityId)
    .maybeSingle();
  if (currentError || !current) {
    return { ok: false, message: currentError?.message ?? "Record not found." };
  }

  try {
    const logoUrl = await uploadEntityLogoFile({
      supabase,
      kind,
      entityId,
      file,
      previousUrl: (current as { logo_url?: string | null }).logo_url,
    });
    revalidateEntityLogoPaths(kind, entityId);
    return { ok: true, message: "Logo uploaded.", logoUrl };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Logo upload failed." };
  }
}

export async function clearEntityLogoAction(formData: FormData): Promise<EntityLogoActionState> {
  const kind = parseEntityLogoKind(formData.get("kind"));
  const entityId = String(formData.get("entity_id") ?? "").trim();
  if (!kind || !entityId) {
    return { ok: false, message: "Choose a group, client, or brand first." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) return { ok: false, message: authError };

  const table = kind === "group" ? "groups" : kind === "client" ? "clients" : "brands";
  const { data: current, error: currentError } = await supabase
    .from(table)
    .select("id, logo_url")
    .eq("id", entityId)
    .maybeSingle();
  if (currentError || !current) {
    return { ok: false, message: currentError?.message ?? "Record not found." };
  }

  try {
    await clearEntityLogoFile({
      supabase,
      kind,
      entityId,
      previousUrl: (current as { logo_url?: string | null }).logo_url,
    });
    revalidateEntityLogoPaths(kind, entityId);
    return { ok: true, message: "Logo removed.", logoUrl: null };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not remove logo." };
  }
}
