/**
 * Shared bulk revalidation control.
 * Safe for server actions and client mutators (no "use client").
 *
 * When set on FormData, existing per-row actions skip revalidatePath so the
 * Platform Bulk Runner can refresh exactly once after the full selection finishes.
 */

export const BULK_DEFER_REVALIDATE_FIELD = "bulk_defer_revalidate";

export function formDataDefersRevalidate(formData: FormData): boolean {
  return String(formData.get(BULK_DEFER_REVALIDATE_FIELD) ?? "") === "1";
}

export function appendBulkDeferRevalidate(formData: FormData): void {
  formData.set(BULK_DEFER_REVALIDATE_FIELD, "1");
}
