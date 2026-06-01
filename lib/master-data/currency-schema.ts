import { z } from "zod";

/** Validates a 3-letter ISO currency code (uppercased). */
export const currencyCodeSchema = z
  .string()
  .trim()
  .length(3, "Use a 3-letter currency code")
  .transform((value) => value.toUpperCase());

export function currencyCodeSchemaWithActive(activeCodes: string[]) {
  const normalized = activeCodes.map((code) => code.toUpperCase());
  return currencyCodeSchema.refine(
    (code) => normalized.includes(code),
    "Select a valid active currency"
  );
}
