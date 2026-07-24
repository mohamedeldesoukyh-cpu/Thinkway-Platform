"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import {
  startTotpEnrollmentAction,
  verifyTotpEnrollmentAction,
  type MfaActionState,
} from "@/features/auth/mfa-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: MfaActionState = { ok: false };

export function MfaEnrollForm({ nextPath = "/" }: { nextPath?: string }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [pendingStart, startTransition] = useTransition();
  const [state, action, pendingVerify] = useActionState(
    verifyTotpEnrollmentAction,
    initial
  );

  useEffect(() => {
    startTransition(async () => {
      const result = await startTotpEnrollmentAction();
      if (!result.ok) {
        setStartError(result.error ?? "Unable to start enrollment.");
        return;
      }
      setFactorId(result.factorId ?? null);
      setQrCode(result.qrCode ?? null);
      setSecret(result.secret ?? null);
    });
  }, []);

  if (startError) {
    return <p className="text-sm text-destructive">{startError}</p>;
  }

  if (pendingStart || !factorId) {
    return <p className="text-sm text-muted-foreground">Preparing authenticator…</p>;
  }

  return (
    <form action={action} className="mx-auto grid w-full max-w-sm gap-4">
      <input type="hidden" name="factor_id" value={factorId} />
      <input type="hidden" name="next" value={nextPath} />

      {qrCode ? (
        <div className="flex justify-center">
          {/* Supabase returns an SVG data URL for totp.qr_code */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="TOTP QR code" className="h-48 w-48" />
        </div>
      ) : null}

      {secret ? (
        <p className="break-all text-xs text-muted-foreground">
          Manual secret: <span className="font-mono">{secret}</span>
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="code">Confirm code from your app</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          required
          disabled={pendingVerify}
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pendingVerify}>
        {pendingVerify ? "Enabling…" : "Enable MFA"}
      </Button>
    </form>
  );
}
