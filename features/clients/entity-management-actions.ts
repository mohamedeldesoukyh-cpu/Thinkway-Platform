"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions-server";
import { deleteEntitySchema, moveBrandSchema } from "./entity-management-schemas";

function message(error: { code?: string; message: string }) {
  if (error.code === "23503") return "Linked records prevent this change. Reassign or remove them through their own workflow first. Issued documents must be preserved.";
  if (error.code === "23505") return "A brand with this name already exists under that client.";
  if (error.code === "PGRST202" || error.code === "42883") return "This action is unavailable until the database safety update is installed.";
  if (error.code === "55P03" || error.code === "40P01") return "Another update is in progress. Refresh and try again.";
  return "The change could not be completed. Refresh and check your permissions.";
}
function refreshEntities() {
  revalidatePath("/brands");
  revalidatePath("/clients", "layout");
  revalidatePath("/groups", "layout");
}
export async function deleteEntityAction(input: unknown) {
  const parsed = deleteEntitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter the exact name to confirm deletion." };
  const supabase = await createSupabaseServerClient();
  const permission = await requirePermission(supabase, "clients.write");
  if ("error" in permission) return { ok: false, message: permission.error };
  const { data, error } = await supabase.rpc("delete_unused_client_entity", {
    p_kind: parsed.data.kind, p_id: parsed.data.id, p_confirmation: parsed.data.confirmation,
  });
  if (error) return { ok: false, message: message(error) };
  if (!data) return { ok: false, message: "The record changed, was not found, or is not accessible. Refresh and verify its name." };
  refreshEntities();
  return { ok: true, message: "Deleted. No linked records were removed." };
}
export async function moveBrandClientAction(input: unknown) {
  const parsed = moveBrandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a different client." };
  const supabase = await createSupabaseServerClient();
  const permission = await requirePermission(supabase, "clients.write");
  if ("error" in permission) return { ok: false, message: permission.error };
  const { data, error } = await supabase.rpc("move_unused_brand_client", {
    p_id: parsed.data.id, p_previous_client_id: parsed.data.previousClientId, p_client_id: parsed.data.clientId,
  });
  if (error) return { ok: false, message: message(error) };
  if (!data) return { ok: false, message: "The brand changed or the client is unavailable. Refresh and try again." };
  refreshEntities();
  return { ok: true, message: "Brand linked to the selected client." };
}
