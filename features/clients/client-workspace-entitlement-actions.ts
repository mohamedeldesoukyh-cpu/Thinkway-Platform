"use server";

import { revalidatePath } from "next/cache";

import { canStartLivePerformancePreview, isClientWorkspacePackage } from "@/features/client-workspace/entitlement";
import { listPendingClientWorkspaceAccessRequests } from "@/features/client-workspace/access-requests";
import { livePreviewWritePayload } from "@/features/clients/client-workspace-entitlement";
import { requireRequestUser } from "@/lib/supabase/server";
import { updateClientWithOptionalColumnRetry } from "@/lib/clients/classification-audit-columns";

export type ClientWorkspacePreviewActionState = { ok: boolean; message?: string };

export async function startClientWorkspaceLivePreviewAction(
  clientId: string
): Promise<ClientWorkspacePreviewActionState> {
  const { supabase, user } = await requireRequestUser();
  void user;
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, client_workspace_enabled, client_workspace_package, client_workspace_preview_expires_at"
    )
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Legal entity not found." };
  const previewActive =
    typeof data.client_workspace_preview_expires_at === "string" &&
    new Date(data.client_workspace_preview_expires_at).getTime() > Date.now();
  const pkg = isClientWorkspacePackage(data.client_workspace_package)
    ? data.client_workspace_package
    : null;
  if (
    !canStartLivePerformancePreview({
      enabled: Boolean(data.client_workspace_enabled),
      package: pkg,
      previewActive,
    })
  ) {
    return { ok: false, message: "Start a preview from Planning or Commercial after Client Workspace is on." };
  }
  const write = await updateClientWithOptionalColumnRetry(supabase, clientId, livePreviewWritePayload(pkg!));
  if (write.error) return { ok: false, message: "Could not start the Live Performance preview." };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, message: "Live Performance preview is active for 14 days." };
}

export async function listClientWorkspaceAccessRequestsAction(clientId: string) {
  const { supabase } = await requireRequestUser();
  return listPendingClientWorkspaceAccessRequests(supabase, clientId);
}
