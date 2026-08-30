"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CREATOR_WORKSPACE_LOGIN_PATH,
  type CreatorWorkspaceAccessView,
} from "@/features/creator-workspace/onboarding";
import {
  generateCreatorWorkspaceLinkAction,
  revokeCreatorWorkspaceAccessAction,
  revokeCreatorWorkspaceInviteAction,
  type CreatorInviteActionState,
} from "@/features/vendors/creator-invite-actions";

const INITIAL: CreatorInviteActionState = { ok: false };

function formatExpiresAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function CreatorWorkspaceAccessPanel({
  access,
}: {
  access: CreatorWorkspaceAccessView;
}) {
  const [generateState, generateAction, generatePending] = useActionState(
    generateCreatorWorkspaceLinkAction,
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
  const [copied, setCopied] = useState(false);
  const [loginCopied, setLoginCopied] = useState(false);

  useEffect(() => {
    for (const state of [generateState, revokeInviteState, revokeAccessState]) {
      if (!state.message) continue;
      if (state.ok) toast.success(state.message);
      else toast.error(state.message);
    }
  }, [generateState, revokeInviteState, revokeAccessState]);

  useEffect(() => {
    setCopied(false);
  }, [generateState.activateUrl]);

  const pending = generatePending || revokeInvitePending || revokeAccessPending;
  const defaultEmail = access.invitedEmail || access.email;
  const activateUrl = generateState.ok ? generateState.activateUrl : undefined;
  const expiresLabel = formatExpiresAt(access.expiresAt);
  const loginUrl =
    typeof window === "undefined"
      ? CREATOR_WORKSPACE_LOGIN_PATH
      : `${window.location.origin}${CREATOR_WORKSPACE_LOGIN_PATH}`;

  async function copyActivateUrl() {
    if (!activateUrl) return;
    await navigator.clipboard.writeText(activateUrl);
    setCopied(true);
    toast.success("Creator Link copied.");
  }

  async function copyLoginUrl() {
    await navigator.clipboard.writeText(loginUrl);
    setLoginCopied(true);
    toast.success("Login link copied.");
  }

  return (
    <CampaignFlatSection
      title="Creator Workspace Access"
      description="Generate a secure 24-hour link for this creator. Thinkway links the account to this profile automatically."
    >
      <p className="text-sm">
        Status: <span className="font-semibold">{access.statusLabel}</span>
        {access.invitedEmail && access.status !== "activated" ? (
          <span className="text-muted-foreground"> · {access.invitedEmail}</span>
        ) : null}
      </p>
      {access.status === "invitation_pending" && expiresLabel ? (
        <p className="mt-1 text-sm text-muted-foreground">Expires: {expiresLabel}</p>
      ) : null}

      {access.canInvite || access.canResend ? (
        <form action={generateAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
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
            {generatePending
              ? "Generating…"
              : access.canResend
                ? "Generate New Link"
                : "Generate Creator Link"}
          </Button>
        </form>
      ) : null}

      {access.status === "invitation_pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {activateUrl ? (
            <Button type="button" variant="outline" onClick={() => void copyActivateUrl()}>
              {copied ? "Copied" : "Copy Link"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Thinkway cannot show this link again. Generate a new link.
            </p>
          )}
        </div>
      ) : null}

      {access.canRevokeInvitation ? (
        <form action={revokeInviteAction} className="mt-3">
          <input type="hidden" name="influencer_id" value={access.influencerId} />
          <Button type="submit" variant="outline" disabled={pending}>
            Revoke
          </Button>
        </form>
      ) : null}

      {access.canCopyLoginLink ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copyLoginUrl()}>
            {loginCopied ? "Copied" : "Copy Login Link"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={CREATOR_WORKSPACE_LOGIN_PATH} target="_blank" rel="noreferrer">
              Open Creator Workspace
            </a>
          </Button>
        </div>
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
