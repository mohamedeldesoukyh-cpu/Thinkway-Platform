import { redirect } from "next/navigation";

import { CREATOR_WORKSPACE_LEGACY_REDIRECTS } from "@/features/creator-workspace/nav";

export default function CreatorPortalPaymentsRedirectPage() {
  redirect(CREATOR_WORKSPACE_LEGACY_REDIRECTS["/creator-portal/payments"]);
}
