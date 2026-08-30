"use client";

import { CheckIcon, CircleIcon, EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import {
  evaluateCreatorInvitePasswordRules,
  scoreCreatorInvitePassword,
  validateCreatorInvitePassword,
} from "@/features/creator-workspace/password";
import { cn } from "@/lib/utils";

export function CreatorInviteSecretField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  required,
  describedBy,
  error,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  describedBy?: string;
  error?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="login-v2-field">
      <label htmlFor={id}>{label}</label>
      <div className="login-v2-input-wrap">
        <span className="login-v2-input-icon" aria-hidden>
          <LockIcon size={14} strokeWidth={2} />
        </span>
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(error && "login-v2-input-error")}
        />
        <button
          type="button"
          className="login-v2-eye"
          title={show ? "Hide password" : "Show password"}
          aria-label={show ? "Hide password" : "Show password"}
          onClick={() => setShow((visible) => !visible)}
        >
          {show ? <EyeOffIcon size={14} strokeWidth={2} /> : <EyeIcon size={14} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}

export function CreatorInviteNewPasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
  optional = false,
  error,
}: {
  password: string;
  confirmPassword: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  optional?: boolean;
  error?: boolean;
}) {
  const guideId = useId();
  const rules = evaluateCreatorInvitePasswordRules(password);
  const strength = scoreCreatorInvitePassword(password);
  const confirmStarted = confirmPassword.length > 0;
  const matches = confirmStarted && password === confirmPassword;
  const mismatch = confirmStarted && password !== confirmPassword;
  const showGuide = password.length > 0 || confirmStarted;

  return (
    <>
      <CreatorInviteSecretField
        id={optional ? "recovery_password" : "password"}
        name="password"
        label={optional ? "New password (optional)" : "Create password"}
        value={password}
        onChange={onPasswordChange}
        autoComplete="new-password"
        required={!optional}
        describedBy={showGuide ? guideId : undefined}
        error={error || mismatch}
      />
      <CreatorInviteSecretField
        id={optional ? "recovery_confirm_password" : "confirm_password"}
        name="confirm_password"
        label={optional ? "Confirm new password" : "Confirm password"}
        value={confirmPassword}
        onChange={onConfirmChange}
        autoComplete="new-password"
        required={!optional}
        describedBy={showGuide ? guideId : undefined}
        error={error || mismatch}
      />
      {showGuide ? (
        <div id={guideId} className="login-v2-password-guide">
          {strength.strength !== "empty" ? (
            <div className="login-v2-password-strength" aria-live="polite">
              <div className="login-v2-password-strength-bars" aria-hidden>
                {[1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className="login-v2-password-strength-bar"
                    data-on={bar <= strength.filledBars ? "true" : "false"}
                    data-tone={strength.strength}
                  />
                ))}
              </div>
              <span
                className="login-v2-password-strength-label"
                data-tone={strength.strength}
              >
                {strength.label}
              </span>
            </div>
          ) : null}
          <ul className="login-v2-password-rules">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="login-v2-password-rule"
                data-met={rule.met ? "true" : "false"}
              >
                {rule.met ? (
                  <CheckIcon size={14} strokeWidth={2.5} aria-hidden />
                ) : (
                  <CircleIcon size={14} strokeWidth={2} aria-hidden />
                )}
                <span>
                  {rule.label}
                  {rule.required ? "" : " — stronger"}
                </span>
              </li>
            ))}
            <li
              className="login-v2-password-rule login-v2-password-match"
              data-met={matches ? "true" : mismatch ? "false" : undefined}
            >
              {matches ? (
                <CheckIcon size={14} strokeWidth={2.5} aria-hidden />
              ) : (
                <CircleIcon size={14} strokeWidth={2} aria-hidden />
              )}
              <span>
                {mismatch ? "Passwords do not match" : "Passwords match"}
              </span>
            </li>
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function syncCreatorInvitePasswordFields(
  event: FormEvent<HTMLFormElement>,
  password: string,
  confirmPassword: string,
  optional = false
): string | null {
  const check = validateCreatorInvitePassword({
    password,
    confirmPassword,
    optional,
  });
  const form = event.currentTarget;
  const passwordInput = form.elements.namedItem("password");
  const confirmInput = form.elements.namedItem("confirm_password");
  if (passwordInput instanceof HTMLInputElement) passwordInput.value = password;
  if (confirmInput instanceof HTMLInputElement) confirmInput.value = confirmPassword;
  if (!check.ok) {
    event.preventDefault();
    return check.message;
  }
  return null;
}
