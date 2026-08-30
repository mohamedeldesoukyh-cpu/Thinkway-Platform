"use client";

import { useActionState, useEffect, useState } from "react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { Button } from "@/components/ui/button";
import {
  CREATOR_INVITE_CONTACT_EMAIL,
  CREATOR_INVITE_EXPIRED_HEADING,
  CREATOR_INVITE_EXPIRED_MESSAGE,
  CREATOR_INVITE_INVALID_MESSAGE,
} from "@/features/creator-workspace/onboarding";
import type { CreatorInviteFailureCode, CreatorInvitePreview } from "@/features/creator-workspace/onboarding";
import {
  CreatorInviteNewPasswordFields,
  CreatorInviteSecretField,
  syncCreatorInvitePasswordFields,
} from "@/features/creator-workspace/components/creator-invite-password-fields";
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
  failureCode,
}: {
  token: string;
  preview: CreatorInvitePreview | null;
  sessionEmail: string | null;
  errorMessage?: string;
  failureCode?: CreatorInviteFailureCode;
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
  const [clientError, setClientError] = useState<string | null>(null);
  const [hideServerError, setHideServerError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const pending = registerPending || acceptPending || resetPending || continuePending;
  const serverError =
    errorMessage ||
    (registerState.message && !registerState.ok
      ? registerState.message
      : acceptState.message && !acceptState.ok
        ? acceptState.message
        : continueState.message && !continueState.ok
          ? continueState.message
          : null);
  const error = clientError || (hideServerError ? null : serverError);

  useEffect(() => {
    if (resetState.message) setShowReset(true);
  }, [resetState.message]);

  function updatePassword(value: string) {
    setPassword(value);
    setClientError(null);
    setHideServerError(true);
  }

  function updateConfirmPassword(value: string) {
    setConfirmPassword(value);
    setClientError(null);
    setHideServerError(true);
  }

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
            <h1 className="login-v2-form-title">
              {failureCode === "expired" ? CREATOR_INVITE_EXPIRED_HEADING : "Activate Creator Workspace"}
            </h1>
            <p className="login-v2-form-sub">
              {failureCode === "expired"
                ? CREATOR_INVITE_EXPIRED_MESSAGE
                : "Thinkway invited you to manage your campaigns, deliverables and payments."}
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
              failureCode === "expired" ? (
                <p className="text-sm text-muted-foreground">
                  Request a new invitation from Thinkway at{" "}
                  <a className="underline" href={`mailto:${CREATOR_INVITE_CONTACT_EMAIL}`}>
                    {CREATOR_INVITE_CONTACT_EMAIL}
                  </a>
                  .
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{CREATOR_INVITE_INVALID_MESSAGE}</p>
              )
            ) : sessionMatches ? (
              <form
                action={continueAction}
                className="login-v2-form"
                onSubmit={(event) => {
                  const message = syncCreatorInvitePasswordFields(
                    event,
                    password,
                    confirmPassword,
                    true
                  );
                  setClientError(message);
                }}
              >
                <input type="hidden" name="token" value={token} />
                <p className="text-sm text-muted-foreground">
                  You are signed in as this email. Continue to finish activation, or set a new
                  password if you used the reset link.
                </p>
                <CreatorInviteNewPasswordFields
                  password={password}
                  confirmPassword={confirmPassword}
                  onPasswordChange={updatePassword}
                  onConfirmChange={updateConfirmPassword}
                  optional
                  error={Boolean(error)}
                />
                <Button type="submit" className="mt-1 w-full" disabled={pending}>
                  {continuePending ? "Opening…" : "Continue to Creator Workspace"}
                </Button>
              </form>
            ) : preview.mode === "register" ? (
              <form
                action={registerAction}
                className="login-v2-form"
                onSubmit={(event) => {
                  const message = syncCreatorInvitePasswordFields(
                    event,
                    password,
                    confirmPassword
                  );
                  setClientError(message);
                }}
              >
                <input type="hidden" name="token" value={token} />
                <CreatorInviteNewPasswordFields
                  password={password}
                  confirmPassword={confirmPassword}
                  onPasswordChange={updatePassword}
                  onConfirmChange={updateConfirmPassword}
                  error={Boolean(error)}
                />
                <Button type="submit" className="mt-1 w-full" disabled={pending}>
                  {registerPending ? "Activating…" : "Activate Creator Workspace"}
                </Button>
              </form>
            ) : (
              <div className="grid gap-3">
                <form action={acceptAction} className="login-v2-form">
                  <input type="hidden" name="token" value={token} />
                  <p className="text-sm text-muted-foreground">
                    This email already has a Thinkway account. Sign in to accept the invitation.
                  </p>
                  <CreatorInviteSecretField
                    id="password"
                    name="password"
                    label="Password"
                    value={password}
                    onChange={updatePassword}
                    autoComplete="current-password"
                    required
                    error={Boolean(error)}
                  />
                  <Button type="submit" className="mt-1 w-full" disabled={pending}>
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
