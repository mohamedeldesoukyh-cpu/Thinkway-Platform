"use client";

import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { signInAction, type SignInFormState } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

const initialState: SignInFormState = { error: null };

type LoginFormProps = {
  nextPath?: string;
  callbackError?: string | null;
};

export function LoginForm({ nextPath = "/", callbackError }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState
  );

  const errorMessage = state.error ?? callbackError;

  return (
    <form action={formAction} className="login-v2-form">
      <input type="hidden" name="next" value={nextPath} />

      <div className="login-v2-field">
        <label htmlFor="email">Email</label>
        <div className="login-v2-input-wrap">
          <span className="login-v2-input-icon" aria-hidden>
            <MailIcon size={14} strokeWidth={2} />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="your@email.com"
            required
            disabled={isPending}
            aria-invalid={errorMessage ? true : undefined}
            className={cn(errorMessage && "login-v2-input-error")}
          />
        </div>
      </div>

      <div className="login-v2-field">
        <label htmlFor="password">Password</label>
        <div className="login-v2-input-wrap">
          <span className="login-v2-input-icon" aria-hidden>
            <LockIcon size={14} strokeWidth={2} />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={isPending}
            aria-invalid={errorMessage ? true : undefined}
            className={cn(errorMessage && "login-v2-input-error")}
          />
          <button
            type="button"
            className="login-v2-eye"
            title={showPassword ? "Hide password" : "Show password"}
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((visible) => !visible)}
            disabled={isPending}
          >
            {showPassword ? (
              <EyeOffIcon size={14} strokeWidth={2} />
            ) : (
              <EyeIcon size={14} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="login-v2-error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <a
        href="mailto:Hello@thinkwaymedia.com"
        className="login-v2-forgot"
      >
        Forgot your password?
      </a>

      <button
        type="submit"
        disabled={isPending}
        className="login-v2-btn-sign"
      >
        {isPending ? "Signing in…" : "SIGN IN"}
      </button>

      <p className="login-v2-create-acc">
        Don&apos;t have an account?{" "}
        <a href="mailto:Hello@thinkwaymedia.com">Contact us</a>
      </p>
    </form>
  );
}
