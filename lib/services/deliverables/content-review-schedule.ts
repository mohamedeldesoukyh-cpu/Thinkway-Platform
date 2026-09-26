/** Client review expectations are independent of publication and financial dates. */
export type ContentReviewDates = { script: string | null; draft: string | null };
export const emptyContentReviewDates = (): ContentReviewDates => ({ script: null, draft: null });

export function validReviewDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function reviewSlotKey(sequence: number | null | undefined): string {
  return sequence && sequence > 0 ? `seq:${sequence}` : "single";
}

export function readContentReviewDates(metadata: Record<string, unknown> | null | undefined, sequence?: number | null): ContentReviewDates {
  const schedule = metadata?.content_review_schedule as Record<string, unknown> | undefined;
  const slot = schedule?.[reviewSlotKey(sequence)] as Partial<ContentReviewDates> | undefined;
  return { script: validReviewDate(slot?.script) ? slot.script : null, draft: validReviewDate(slot?.draft) ? slot.draft : null };
}

export function mergeContentReviewDates(metadata: Record<string, unknown>, sequence: number | null, dates: ContentReviewDates, actor: string) {
  return { ...metadata, content_review_schedule: {
    ...(metadata.content_review_schedule as Record<string, unknown> ?? {}),
    [reviewSlotKey(sequence)]: { ...dates, updated_by: actor, updated_at: new Date().toISOString() },
  } };
}
