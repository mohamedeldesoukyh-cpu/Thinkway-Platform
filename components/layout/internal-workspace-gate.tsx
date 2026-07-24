import { redirect } from "next/navigation";

import {
  isPortalActor,
  resolveWorkspaceActor,
} from "@/lib/security/workspace-actor";
import { portalHomePath } from "@/lib/security/workspace-auth";
import { createSupabaseServerClient, getRequestAuth } from "@/lib/supabase/server";

/**
 * Hard edge for the internal dashboard shell: portal actors must never render
 * Finance / Operations / Discovery UI even if middleware is bypassed.
 */
export async function InternalWorkspaceGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { user } = await getRequestAuth();

  if (user) {
    const actor = await resolveWorkspaceActor(supabase, user.id);
    if (isPortalActor(actor.kind)) {
      redirect(portalHomePath(actor.kind));
    }
  }

  return children;
}
