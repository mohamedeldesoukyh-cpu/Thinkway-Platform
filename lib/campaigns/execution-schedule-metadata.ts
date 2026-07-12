import type { QuotationTentativeScheduleFields } from "@/lib/domains/commercial/quotation-types";

export const POSTING_DATE_STATUS_TENTATIVE = "tentative" as const;
export const POSTING_DATE_STATUS_CONFIRMED = "confirmed" as const;

export type PostingDateStatus =
  | typeof POSTING_DATE_STATUS_TENTATIVE
  | typeof POSTING_DATE_STATUS_CONFIRMED;

export type ExecutionScheduleMetadata = {
  posting_date_status: PostingDateStatus;
  planned_posting_date: string | null;
  planned_posting_label: string | null;
  planned_week: number | null;
  planned_day: string | null;
  schedule_source: string | null;
  inherited_at: string;
};

export function buildTentativeExecutionMetadata(
  schedule: QuotationTentativeScheduleFields,
  inheritedAt = new Date().toISOString()
): ExecutionScheduleMetadata {
  return {
    posting_date_status: POSTING_DATE_STATUS_TENTATIVE,
    planned_posting_date: schedule.tentative_posting_date ?? null,
    planned_posting_label: schedule.tentative_posting_label ?? null,
    planned_week: schedule.planned_week ?? null,
    planned_day: schedule.planned_day ?? null,
    schedule_source: schedule.schedule_source ?? null,
    inherited_at: inheritedAt,
  };
}

export function mergeExecutionScheduleMetadata(
  existing: Record<string, unknown> | null | undefined,
  schedule: ExecutionScheduleMetadata
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    ...schedule,
  };
}
