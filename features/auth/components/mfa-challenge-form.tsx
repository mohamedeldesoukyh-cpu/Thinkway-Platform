"use client";

import { useActionState } from "react";

import {
  verifyTotpChallengeAction,
  type MfaActionState,
} from "@/features/auth/mfa-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: MfaActionState = { ok: false };

export function MfaChallengeForm({ nextPath = "/" }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(verifyTotpChallengeAction, initial);

  return (
    <form action={action} className="mx-auto grid w-full max-w-sm gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <div className="grid gap-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          required
          disabled={pending}
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Verifying…" : "Verify and continue"}
      </Button>
    </form>
  );
}
