"use server";

import { redirect } from "next/navigation";

import { roleRequiresMfa } from "@/lib/auth/mfa-policy";
import { sanitizeNextPath } from "@/lib/auth/routes";
import { requireRequestUser } from "@/lib/supabase/server";
import {
  mfaVerifyChallengeSchema,
  mfaVerifyEnrollmentSchema,
} from "@/lib/validation/schemas";

export type MfaActionState = {
  ok: boolean;
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
};

export async function startTotpEnrollmentAction(): Promise<MfaActionState> {
  try {
    const { supabase, roleSlug } = await requireRequestUser();
    if (!roleRequiresMfa(roleSlug)) {
      return {
        ok: false,
        error: "Your role does not require multi-factor authentication.",
      };
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Thinkway Authenticator",
    });

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Unable to start MFA enrollment." };
    }

    return {
      ok: true,
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to start MFA enrollment.",
    };
  }
}

export async function verifyTotpEnrollmentAction(
  _prev: MfaActionState,
  formData: FormData
): Promise<MfaActionState> {
  const parsed = mfaVerifyEnrollmentSchema.safeParse({
    factor_id: String(formData.get("factor_id") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim(),
    next:
      typeof formData.get("next") === "string"
        ? (formData.get("next") as string)
        : "/",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Authenticator code is required.",
    };
  }

  const factorId = parsed.data.factor_id;
  const code = parsed.data.code;
  const next = sanitizeNextPath(parsed.data.next);

  try {
    const { supabase } = await requireRequestUser();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      return {
        ok: false,
        error: challenge.error?.message ?? "Unable to create MFA challenge.",
      };
    }

    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });

    if (verified.error) {
      return { ok: false, error: verified.error.message };
    }

    redirect(next);
  } catch (error) {
    // redirect() throws; rethrow Next redirect
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "MFA verification failed.",
    };
  }
}

export async function verifyTotpChallengeAction(
  _prev: MfaActionState,
  formData: FormData
): Promise<MfaActionState> {
  const parsed = mfaVerifyChallengeSchema.safeParse({
    code: String(formData.get("code") ?? "").trim(),
    next:
      typeof formData.get("next") === "string"
        ? (formData.get("next") as string)
        : "/",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Authenticator code is required.",
    };
  }

  const code = parsed.data.code;
  const next = sanitizeNextPath(parsed.data.next);

  try {
    const { supabase } = await requireRequestUser();
    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError) {
      return { ok: false, error: factorsError.message };
    }

    const factor = factors?.totp?.find((item) => item.status === "verified");
    if (!factor) {
      return {
        ok: false,
        error: "No verified authenticator found. Enroll MFA first.",
      };
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error || !challenge.data) {
      return {
        ok: false,
        error: challenge.error?.message ?? "Unable to create MFA challenge.",
      };
    }

    const verified = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code,
    });

    if (verified.error) {
      return { ok: false, error: verified.error.message };
    }

    redirect(next);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "MFA verification failed.",
    };
  }
}
