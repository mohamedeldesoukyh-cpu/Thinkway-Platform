"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreatorWorkspaceAccessView } from "@/features/creator-workspace/onboarding";
import {
  inviteCreatorToWorkspaceAction,
  resendCreatorWorkspaceInviteAction,
  revokeCreatorWorkspaceAccessAction,
  revokeCreatorWorkspaceInviteAction,
  type CreatorInviteActionState,
} from "@/features/vendors/creator-invite-actions";

const INITIAL: CreatorInviteActionState = { ok: false };

export function CreatorWorkspaceAccessPanel({
  access,
}: {
  access: CreatorWorkspaceAccessView;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteCreatorToWorkspaceAction,
    INITIAL
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendCreatorWorkspaceInviteAction,
    INITIAL
  );
  const [revokeInviteState, revokeInviteAction, revokeInvitePending] = useActionState(
    revokeCreatorWorkspaceInviteAction,
    INITIAL
  );
  const [revokeAccessState, revokeAccessAction, revokeAccessPending] = useActionState(
    revokeCreatorWorkspaceAccessAction,
    INITIAL
  );

  useEffect(() => {
    for (const state of [inviteState, resendState, revokeInviteState, revokeAccessState]) {
      if (!state.message) continue;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [inviteState, resendState, revokeInviteState, revokeAccessState]);

  const pending =
    invitePending || resendPending || revokeInvitePending || revokeAccessPending;
  const defaultEmail = access.invitedEmail || access.email;

  return (
    <CampaignFlatSection
      title="Creator Workspace Access"
      description="Invite the creator to activate their own secure login. Thinkway links the account to this profile automatically."
    >
      <p className="text-sm">
        Status: <span className="font-semibold">{access.statusLabel}</span>
        {access.invitedEmail && access.status !== "activated" ? (
          <span className="text-muted-foreground"> · {access.invitedEmail}</span>
        ) : null}
      </p>

      {access.canInvite || access.canResend ? (
        <form action={access.canResend ? resendAction : inviteAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="influencer_id" value={access.influencerId} />
          <div className="grid gap-2">
            <Label htmlFor="creator-invite-email">Invitation email</Label>
            <Input
              id="creator-invite-email"
              name="email"
              type="email"
              required
              defaultValue={defaultEmail}
              disabled={pending}
            />
          </div>
          <Button type="submit" className="self-end" disabled={pending}>
            {pending
              ? "Sending…"
              : access.canResend
                ? "Resend invitation"
                : "Invite Creator"}
          </Button>
        </form>
      ) : null}

      {access.canRevokeInvitation ? (
        <form action={revokeInviteAction} className="mt-3">
          <input type="hidden" name="influencer_id" value={access.influencerId} />
          <Button type="submit" variant="outline" disabled={pending}>
            Revoke invitation
          </Button>
        </form>
      ) : null}

      {access.canRevokeAccess ? (
        <form action={revokeAccessAction} className="mt-3">
          <input type="hidden" name="influencer_id" value={access.influencerId} />
          <Button type="submit" variant="outline" disabled={pending}>
            Revoke access
          </Button>
        </form>
      ) : null}
    </CampaignFlatSection>
  );
}
