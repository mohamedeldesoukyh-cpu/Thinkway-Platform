"use client";

import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";
import { LoginForm } from "@/features/auth/components/login-form";

type LoginScreenProps = {
  nextPath: string;
  callbackError: string | null;
};

function LoginLogo() {
  return (
    <div className="login-v2-logo">
      <div className="login-v2-logo-mark" aria-hidden />
      <div className="login-v2-logo-text">
        THINK<span>WAY</span>
      </div>
    </div>
  );
}

export function LoginScreen({ nextPath, callbackError }: LoginScreenProps) {
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
            <LoginLogo />

            <h1 className="login-v2-form-title">Sign in</h1>
            <p className="login-v2-form-sub">
              Sign in with your company email to continue
            </p>

            <LoginForm nextPath={nextPath} callbackError={callbackError} />
          </div>

          <LoginBrandPanel />
        </div>
      </div>
    </div>
  );
}
