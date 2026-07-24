"use server";

import { resolveEffectiveExchangeRate } from "@/features/finance/exchange-rates/queries";
import { getRequestAuth, requireRequestUser } from "@/lib/supabase/server";

export type ResolveExchangeRateState = {
  ok: boolean;
  rate?: number;
  message?: string;
};

const INTERNAL_ROLES = new Set([
  "super_admin",
  "admin",
  "account_manager",
  "finance",
  "operations",
]);

/**
 * Resolve an effective FX rate for internal staff.
 * Unauthenticated and portal roles are rejected; RLS also limits table reads
 * to `is_internal_user()`.
 */
export async function resolveExchangeRateAction(input: {
  from_currency: string;
  to_currency: string;
  as_of?: string;
}): Promise<ResolveExchangeRateState> {
  try {
    await requireRequestUser();
    const { roleSlug } = await getRequestAuth();
    if (roleSlug && !INTERNAL_ROLES.has(roleSlug)) {
      return { ok: false, message: "You do not have permission to resolve exchange rates." };
    }

    const from = input.from_currency.trim().toUpperCase();
    const to = input.to_currency.trim().toUpperCase();
    if (!from || !to) {
      return { ok: false, message: "From and to currency are required." };
    }
    if (from === to) {
      return { ok: true, rate: 1 };
    }
    const rate = await resolveEffectiveExchangeRate({
      from_currency: from,
      to_currency: to,
      as_of: input.as_of,
    });
    return { ok: true, rate };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to resolve exchange rate.",
    };
  }
}
