"use server";

import { resolveEffectiveExchangeRate } from "@/features/finance/exchange-rates/queries";

export type ResolveExchangeRateState = {
  ok: boolean;
  rate?: number;
  message?: string;
};

export async function resolveExchangeRateAction(input: {
  from_currency: string;
  to_currency: string;
  as_of?: string;
}): Promise<ResolveExchangeRateState> {
  try {
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
