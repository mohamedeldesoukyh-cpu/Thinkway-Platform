"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type SignInFormState } from "@/features/auth/actions";

const initialState: SignInFormState = { error: null };

type LoginFormProps = {
  nextPath?: string;
  callbackError?: string | null;
};

export function LoginForm({ nextPath = "/", callbackError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState
  );

  const errorMessage = state.error ?? callbackError;

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={nextPath} />
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          disabled={isPending}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={isPending}
        />
      </div>
      {errorMessage ? (
        <p className="rounded-3xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
