import type { ZodType } from "zod";

import { formatZodIssues, type ValidationErrorBody } from "./http";

export type FormValidationFailure = {
  ok: false;
  message: string;
  issues: ValidationErrorBody["issues"];
};

/**
 * Parse FormData into a plain object then validate with Zod.
 * Multi-value keys keep the first value (typical for HTML forms).
 */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) {
    if (out[key] === undefined) {
      out[key] = value;
    }
  }
  return out;
}

export function parseFormDataWithSchema<T>(
  formData: FormData,
  schema: ZodType<T>
): { ok: true; data: T } | FormValidationFailure {
  const raw = formDataToObject(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error);
    return {
      ok: false,
      message: issues[0]?.message ?? "Invalid form data.",
      issues,
    };
  }
  return { ok: true, data: parsed.data };
}
