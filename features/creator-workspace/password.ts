import { CREATOR_INVITE_PASSWORD_MIN } from "@/features/creator-workspace/onboarding";

export type CreatorInvitePasswordRuleId = "length" | "letter" | "number";

export type CreatorInvitePasswordRule = {
  id: CreatorInvitePasswordRuleId;
  label: string;
  test: (password: string) => boolean;
};

export const CREATOR_INVITE_PASSWORD_RULES: CreatorInvitePasswordRule[] = [
  {
    id: "length",
    label: `At least ${CREATOR_INVITE_PASSWORD_MIN} characters`,
    test: (password) => password.length >= CREATOR_INVITE_PASSWORD_MIN,
  },
  {
    id: "letter",
    label: "At least one letter",
    test: (password) => /[A-Za-z]/.test(password),
  },
  {
    id: "number",
    label: "At least one number",
    test: (password) => /\d/.test(password),
  },
];

export const CREATOR_INVITE_PASSWORD_HINTS: { id: string; label: string; test: (password: string) => boolean }[] =
  [
    {
      id: "case",
      label: "Upper and lowercase letters",
      test: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    {
      id: "symbol",
      label: "A symbol (!@#$…)",
      test: (password) => /[^A-Za-z0-9]/.test(password),
    },
  ];

export type CreatorInvitePasswordStrength =
  | "empty"
  | "weak"
  | "medium"
  | "strong"
  | "very_strong";

export const CREATOR_INVITE_PASSWORD_STRENGTH_LABEL: Record<
  Exclude<CreatorInvitePasswordStrength, "empty">,
  string
> = {
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
  very_strong: "Very strong",
};

export function evaluateCreatorInvitePasswordRules(password: string) {
  return CREATOR_INVITE_PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
    required: true as const,
  })).concat(
    CREATOR_INVITE_PASSWORD_HINTS.map((rule) => ({
      id: rule.id,
      label: rule.label,
      met: rule.test(password),
      required: false as const,
    }))
  );
}

export function creatorInvitePasswordMeetsPolicy(password: string): boolean {
  return CREATOR_INVITE_PASSWORD_RULES.every((rule) => rule.test(password));
}

export function scoreCreatorInvitePassword(password: string): {
  strength: CreatorInvitePasswordStrength;
  label: string;
  filledBars: number;
} {
  if (!password) {
    return { strength: "empty", label: "", filledBars: 0 };
  }
  let filledBars = 0;
  if (password.length >= CREATOR_INVITE_PASSWORD_MIN) filledBars += 1;
  if (creatorInvitePasswordMeetsPolicy(password)) filledBars += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) filledBars += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) filledBars += 1;

  if (filledBars <= 1) {
    return { strength: "weak", label: CREATOR_INVITE_PASSWORD_STRENGTH_LABEL.weak, filledBars: Math.max(1, filledBars) };
  }
  if (filledBars === 2) {
    return { strength: "medium", label: CREATOR_INVITE_PASSWORD_STRENGTH_LABEL.medium, filledBars };
  }
  if (filledBars === 3) {
    return { strength: "strong", label: CREATOR_INVITE_PASSWORD_STRENGTH_LABEL.strong, filledBars };
  }
  return {
    strength: "very_strong",
    label: CREATOR_INVITE_PASSWORD_STRENGTH_LABEL.very_strong,
    filledBars: 4,
  };
}

export function validateCreatorInvitePassword(input: {
  password: string;
  confirmPassword: string;
  optional?: boolean;
}): { ok: true } | { ok: false; message: string } {
  const password = input.password;
  const confirmPassword = input.confirmPassword;
  if (input.optional && !password && !confirmPassword) return { ok: true };
  if (password !== confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }
  const failed = CREATOR_INVITE_PASSWORD_RULES.find((rule) => !rule.test(password));
  if (!failed) return { ok: true };
  if (failed.id === "length") {
    return {
      ok: false,
      message: `Password must be at least ${CREATOR_INVITE_PASSWORD_MIN} characters.`,
    };
  }
  return { ok: false, message: `Password must include ${failed.label.toLowerCase()}.` };
}
