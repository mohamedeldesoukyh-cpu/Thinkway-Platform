"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmClientIoApprovalAction } from "@/features/io/approve-client-io-action";
import { IoApprovalResultCard } from "@/features/io/components/io-approval-result-card";

export function ClientIoApprovalConfirmation({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmClientIoApprovalAction, {});
  if (state.result) return <IoApprovalResultCard kindLabel="Client IO" outcome={state.result.outcome} documentNumber={state.result.documentNumber} confirmationEmailSent={state.result.ok ? state.result.confirmationEmailSent : undefined} />;
  return <main className="mx-auto max-w-lg p-4 md:p-8">
    <form action={action} className="space-y-4 rounded-xl border bg-card p-6">
      <h1 className="text-xl font-semibold">Approve Client IO</h1>
      <p className="text-sm text-muted-foreground">Confirm your email to record who approved this document and receive the approval confirmation.</p>
      <input type="hidden" name="token" value={token} />
      <label className="block space-y-2"><span>Your email</span><Input name="email" type="email" autoComplete="email" required disabled={pending} /></label>
      {state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? "Approving…" : "Confirm approval"}</Button>
    </form>
  </main>;
}
