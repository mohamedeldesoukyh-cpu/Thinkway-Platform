import type { SupabaseClient } from "@supabase/supabase-js";

import { hasPermission } from "@/lib/auth/permissions";

import type { CampaignObjectLifecycleStatus } from "../types/campaign-lifecycle";

const TRANSITIONS: Record<
  CampaignObjectLifecycleStatus,
  CampaignObjectLifecycleStatus[]
> = {
  draft: ["in_review", "archived"],
  in_review: ["approved", "draft", "archived"],
  approved: ["published", "archived", "in_review"],
  published: ["archived"],
  archived: ["draft"],
};

export function isValidLifecycleTransition(
  from: CampaignObjectLifecycleStatus,
  to: CampaignObjectLifecycleStatus
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export async function canTransitionLifecycle(
  supabase: SupabaseClient,
  roleSlug: string | null,
  from: CampaignObjectLifecycleStatus,
  to: CampaignObjectLifecycleStatus
): Promise<boolean> {
  if (!isValidLifecycleTransition(from, to)) return false;
  if (from === to) return true;

  if (roleSlug === "super_admin" || roleSlug === "admin" || roleSlug === "director") {
    return true;
  }

  if (to === "in_review" || to === "draft" || to === "archived") {
    return hasPermission(supabase, "ai.write");
  }

  if (to === "approved") {
    return (
      hasPermission(supabase, "approvals.write") ||
      hasPermission(supabase, "ai.write")
    );
  }

  if (to === "published") {
    return hasPermission(supabase, "ai.write");
  }

  return false;
}

export function lifecycleLabel(status: CampaignObjectLifecycleStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "in_review":
      return "In Review";
    case "approved":
      return "Approved";
    case "archived":
      return "Archived";
    case "published":
      return "Published";
    default:
      return status;
  }
}
