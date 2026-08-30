"use client";

import { useActionState, useEffect, useState } from "react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreatorInvitePreview } from "@/features/creator-workspace/onboarding";
import { CREATOR_INVITE_INVALID_MESSAGE, CREATOR_INVITE_PASSWORD_MIN } from "@/features/creator-workspace/onboarding";
import {
  acceptCreatorInviteAction,
  continueCreatorInviteSessionAction,
  registerFromCreatorInviteAction,
  requestCreatorInvitePasswordResetAction,
  type CreatorInviteFormState,
} from "@/app/creator-invite/actions";

const INITIAL: CreatorInviteFormState = { ok: false };

export function CreatorInviteActivateForm({
  token,
  preview,
  sessionEmail,
  errorMessage,
}: {
  token: string;
  preview: CreatorInvitePreview | null;
  sessionEmail: string | null;
  errorMessage?: string;
}) {
  const sessionMatches =
    Boolean(preview) &&
    Boolean(sessionEmail) &&
    sessionEmail!.trim().toLowerCase() === preview!.email.trim().toLowerCase();

  const [registerState, registerAction, registerPending] = useActionState(
    registerFromCreatorInviteAction,
    INITIAL
  );
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptCreatorInviteAction,
    INITIAL
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestCreatorInvitePasswordResetAction,
    INITIAL
  );
  const [continueState, continueAction, continuePending] = useActionState(
    continueCreatorInviteSessionAction,
    INITIAL
  );
  const [showReset, setShowReset] = useState(false);

  const pending = registerPending || acceptPending || resetPending || continuePending;
  const error =
    errorMessage ||
    (registerState.message && !registerState.ok
      ? registerState.message
      : acceptState.message && !acceptState.ok
        ? acceptState.message
        : continueState.message && !continueState.ok
          ? continueState.message
          : null);

  useEffect(() => {
    if (resetState.message) setShowReset(true);
  }, [resetState.message]);

  return (
    <div className="login-screen login-v2">
      <div className="login-v2-bg" aria-hidden>
        <div className="login-v2-blob login-v2-blob-1" />
        <div className="login-v2-blob login-v2-blob-2" />
        <div className="login-v2-blob login-v2-blob-3" />
      </div>
      <div className="login-v2-wrapper">
        <div className="login-v2-card">
          <div className="login-v2-form-panel">
            <ThinkwayLogo />
            <h1 className="login-v2-form-title">Activate Creator Workspace</h1>
            <p className="login-v2-form-sub">
              Thinkway invited you to manage your campaigns, deliverables and payments.
            </p>

            {preview ? (
              <div className="mb-4 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Creator</span>
                  <br />
                  <span className="font-semibold">{preview.displayName}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Email</span>
                  <br />
                  <span className="font-semibold">{preview.email}</span>
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="mb-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            {!preview || !token ? (
              <p className="text-sm text-muted-foreground">{CREATOR_INVITE_INVALID_MESSAGE}</p>
            ) : sessionMatches ? (
              <form action={continueAction} className="grid gap-3">
                <input type="hidden" name="token" value={token} />
                <p className="text-sm text-muted-foreground">
                  You are signed in as this email. Continue to finish activation, or set a new
                  password if you used the reset link.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="recovery_password">New password (optional)</Label>
                  <Input
                    id="recovery_password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={CREATOR_INVITE_PASSWORD_MIN}
                    disabled={pending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="recovery_confirm_password">Confirm new password</Label>
                  <Input
                    id="recovery_confirm_password"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={CREATOR_INVITE_PASSWORD_MIN}
                    disabled={pending}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  {continuePending ? "Opening…" : "Continue to Creator Workspace"}
                </Button>
              </form>
            ) : preview.mode === "register" ? (
              <form action={registerAction} className="grid gap-3">
                <input type="hidden" name="token" value={token} />
                <div className="grid gap-2">
                  <Label htmlFor="password">Create password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={CREATOR_INVITE_PASSWORD_MIN}
                    required
                    disabled={pending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm_password">Confirm password</Label>
                  <Input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={CREATOR_INVITE_PASSWORD_MIN}
                    required
                    disabled={pending}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  {registerPending ? "Activating…" : "Activate Creator Workspace"}
                </Button>
              </form>
            ) : (
              <div className="grid gap-3">
                <form action={acceptAction} className="grid gap-3">
                  <input type="hidden" name="token" value={token} />
                  <p className="text-sm text-muted-foreground">
                    This email already has a Thinkway account. Sign in to accept the invitation.
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      disabled={pending}
                    />
                  </div>
                  <Button type="submit" disabled={pending}>
                    {acceptPending ? "Signing in…" : "Accept invitation"}
                  </Button>
                </form>
                <form action={resetAction}>
                  <input type="hidden" name="token" value={token} />
                  <Button type="submit" variant="ghost" disabled={pending}>
                    Forgot password?
                  </Button>
                </form>
                {showReset && resetState.message ? (
                  <p className="text-sm text-muted-foreground">{resetState.message}</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
