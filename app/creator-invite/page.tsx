import type { Metadata } from "next";

import { CreatorInviteActivateForm } from "@/features/creator-workspace/components/creator-invite-activate-form";
import { previewCreatorInvite } from "@/features/creator-workspace/onboarding-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Activate Creator Workspace",
};

type CreatorInvitePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function CreatorInvitePage({
  searchParams,
}: CreatorInvitePageProps) {
  const { token: rawToken } = await searchParams;
  const token = rawToken?.trim() ?? "";

  if (!token) {
    return <CreatorInviteActivateForm token="" preview={null} sessionEmail={null} />;
  }

  const preview = await previewCreatorInvite(token);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!preview.ok) {
    return (
      <CreatorInviteActivateForm
        token=""
        preview={null}
        sessionEmail={null}
        failureCode={preview.code}
      />
    );
  }

  return (
    <CreatorInviteActivateForm
      token={token}
      preview={preview.data}
      sessionEmail={user?.email ?? null}
    />
  );
}
