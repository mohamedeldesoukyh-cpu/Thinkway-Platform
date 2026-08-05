export type ClientIoMilestoneKind =
  | "upfront"
  | "kickoff"
  | "completion"
  | "monthly"
  | "custom";

export type ClientIoMilestoneDueTrigger =
  | "on_approval"
  | "on_kickoff"
  | "on_completion"
  | "on_send"
  | "calendar_date"
  | "custom";

export type ClientIoMilestoneDraft = {
  /** Client-side / persisted id when editing existing rows. */
  id?: string;
  label: string;
  milestoneKind: ClientIoMilestoneKind;
  percent: number;
  dueTrigger: ClientIoMilestoneDueTrigger;
  dueOffsetDays: number | null;
  dueDate: string | null;
  notes: string | null;
  sortOrder: number;
};

export type ClientIoMilestoneTemplateId =
  | "approval_100"
  | "net_30"
  | "net_60"
  | "net_90"
  | "fifty_fifty"
  | "monthly_3"
  | "completion_100"
  | "custom";

export const CLIENT_IO_MILESTONE_TEMPLATE_OPTIONS: Array<{
  id: ClientIoMilestoneTemplateId;
  label: string;
  description: string;
}> = [
  {
    id: "approval_100",
    label: "100% on approval",
    description: "Full amount due when the Client IO is approved.",
  },
  {
    id: "net_30",
    label: "30 days",
    description: "100% due Net 30 from Client IO approval / invoice.",
  },
  {
    id: "net_60",
    label: "60 days",
    description: "100% due Net 60 from Client IO approval / invoice.",
  },
  {
    id: "net_90",
    label: "90 days",
    description: "100% due Net 90 from Client IO approval / invoice.",
  },
  {
    id: "fifty_fifty",
    label: "50% / 50%",
    description: "Half at kickoff, half on campaign completion.",
  },
  {
    id: "monthly_3",
    label: "Monthly (3)",
    description: "Three equal monthly installments — adjust as needed.",
  },
  {
    id: "completion_100",
    label: "Completion",
    description: "Full amount due on campaign completion.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Start from an empty schedule and define your own rows.",
  },
];

export const CLIENT_IO_MILESTONE_DUE_TRIGGER_LABELS: Record<
  ClientIoMilestoneDueTrigger,
  string
> = {
  on_approval: "On approval",
  on_kickoff: "On kickoff",
  on_completion: "On completion",
  on_send: "On send",
  calendar_date: "Calendar date",
  custom: "Custom",
};

const PERCENT_TOTAL_TOLERANCE = 0.01;

function row(
  partial: Omit<ClientIoMilestoneDraft, "sortOrder"> & { sortOrder?: number },
  index: number
): ClientIoMilestoneDraft {
  return {
    label: partial.label,
    milestoneKind: partial.milestoneKind,
    percent: partial.percent,
    dueTrigger: partial.dueTrigger,
    dueOffsetDays: partial.dueOffsetDays ?? null,
    dueDate: partial.dueDate ?? null,
    notes: partial.notes ?? null,
    sortOrder: partial.sortOrder ?? index + 1,
  };
}

export function buildClientIoMilestoneTemplate(
  templateId: ClientIoMilestoneTemplateId
): ClientIoMilestoneDraft[] {
  switch (templateId) {
    case "approval_100":
      return [
        row(
          {
            label: "100% on Client IO approval",
            milestoneKind: "upfront",
            percent: 100,
            dueTrigger: "on_approval",
            dueOffsetDays: 0,
            dueDate: null,
            notes: null,
          },
          0
        ),
      ];
    case "net_30":
      return [
        row(
          {
            label: "100% — Net 30 Days",
            milestoneKind: "upfront",
            percent: 100,
            dueTrigger: "on_approval",
            dueOffsetDays: 30,
            dueDate: null,
            notes: "Payment due within 30 days of Client IO approval / invoice.",
          },
          0
        ),
      ];
    case "net_60":
      return [
        row(
          {
            label: "100% — Net 60 Days",
            milestoneKind: "upfront",
            percent: 100,
            dueTrigger: "on_approval",
            dueOffsetDays: 60,
            dueDate: null,
            notes: "Payment due within 60 days of Client IO approval / invoice.",
          },
          0
        ),
      ];
    case "net_90":
      return [
        row(
          {
            label: "100% — Net 90 Days",
            milestoneKind: "upfront",
            percent: 100,
            dueTrigger: "on_approval",
            dueOffsetDays: 90,
            dueDate: null,
            notes: "Payment due within 90 days of Client IO approval / invoice.",
          },
          0
        ),
      ];
    case "fifty_fifty":
      return [
        row(
          {
            label: "50% at campaign kickoff",
            milestoneKind: "kickoff",
            percent: 50,
            dueTrigger: "on_kickoff",
            dueOffsetDays: 0,
            dueDate: null,
            notes: null,
          },
          0
        ),
        row(
          {
            label: "50% on campaign completion",
            milestoneKind: "completion",
            percent: 50,
            dueTrigger: "on_completion",
            dueOffsetDays: 0,
            dueDate: null,
            notes: null,
          },
          1
        ),
      ];
    case "monthly_3":
      return [1, 2, 3].map((month, index) =>
        row(
          {
            label: `Month ${month} installment`,
            milestoneKind: "monthly",
            percent: month === 1 ? 33.34 : 33.33,
            dueTrigger: "custom",
            dueOffsetDays: (month - 1) * 30,
            dueDate: null,
            notes: null,
          },
          index
        )
      );
    case "completion_100":
      return [
        row(
          {
            label: "100% on campaign completion",
            milestoneKind: "completion",
            percent: 100,
            dueTrigger: "on_completion",
            dueOffsetDays: 0,
            dueDate: null,
            notes: null,
          },
          0
        ),
      ];
    case "custom":
    default:
      return [];
  }
}

export type ClientIoMilestoneValidationResult =
  | { ok: true; milestones: ClientIoMilestoneDraft[]; totalPercent: number }
  | { ok: false; error: string };

export function normalizeClientIoMilestoneDrafts(
  input: ClientIoMilestoneDraft[]
): ClientIoMilestoneDraft[] {
  return input.map((milestone, index) => ({
    ...milestone,
    label: milestone.label.trim(),
    percent: Number(milestone.percent),
    dueOffsetDays:
      milestone.dueOffsetDays == null || Number.isNaN(Number(milestone.dueOffsetDays))
        ? null
        : Math.max(0, Math.round(Number(milestone.dueOffsetDays))),
    dueDate: milestone.dueDate?.trim() || null,
    notes: milestone.notes?.trim() || null,
    sortOrder: index + 1,
  }));
}

export function validateClientIoMilestones(
  input: ClientIoMilestoneDraft[]
): ClientIoMilestoneValidationResult {
  const milestones = normalizeClientIoMilestoneDrafts(input);

  if (milestones.length === 0) {
    return { ok: true, milestones, totalPercent: 0 };
  }

  for (const milestone of milestones) {
    if (!milestone.label) {
      return { ok: false, error: "Each milestone needs a description." };
    }
    if (!Number.isFinite(milestone.percent)) {
      return { ok: false, error: "Milestone percentages must be valid numbers." };
    }
    if (milestone.percent < 0) {
      return { ok: false, error: "Milestone percentages cannot be negative." };
    }
    if (milestone.percent > 100) {
      return { ok: false, error: "A single milestone cannot exceed 100%." };
    }
    if (milestone.dueTrigger === "calendar_date" && !milestone.dueDate) {
      return { ok: false, error: "Calendar-date milestones require a due date." };
    }
  }

  const totalPercent = milestones.reduce((sum, row) => sum + row.percent, 0);
  if (Math.abs(totalPercent - 100) > PERCENT_TOTAL_TOLERANCE) {
    return {
      ok: false,
      error: `Milestone percentages must total 100% (currently ${totalPercent.toFixed(2)}%).`,
    };
  }

  return { ok: true, milestones, totalPercent: 100 };
}

/** Statuses where milestone schedule may still be edited on the tip. */
export const CLIENT_IO_MILESTONE_EDITABLE_STATUSES = new Set([
  "draft",
  "generated",
]);

export function isClientIoMilestoneEditable(
  status: string,
  isSuperseded = false
): boolean {
  if (isSuperseded) return false;
  return CLIENT_IO_MILESTONE_EDITABLE_STATUSES.has(status);
}

export function formatClientIoMilestoneTrigger(
  milestone: Pick<ClientIoMilestoneDraft, "dueTrigger" | "dueOffsetDays" | "dueDate">
): string {
  const base =
    CLIENT_IO_MILESTONE_DUE_TRIGGER_LABELS[milestone.dueTrigger] ?? milestone.dueTrigger;
  if (milestone.dueTrigger === "calendar_date" && milestone.dueDate) {
    return `${base}: ${milestone.dueDate}`;
  }
  if (milestone.dueOffsetDays != null && milestone.dueOffsetDays > 0) {
    return `${base} + ${milestone.dueOffsetDays} day${milestone.dueOffsetDays === 1 ? "" : "s"}`;
  }
  return base;
}

export function formatClientIoMilestonesPaymentSchedule(
  milestones: ClientIoMilestoneDraft[]
): string | null {
  if (milestones.length === 0) return null;
  return milestones
    .map((milestone, index) => {
      const trigger = formatClientIoMilestoneTrigger(milestone);
      const notes = milestone.notes ? ` — ${milestone.notes}` : "";
      return `${index + 1}. ${milestone.label} — ${formatPercent(milestone.percent)} (${trigger})${notes}`;
    })
    .join("; ");
}

function formatPercent(value: number): string {
  if (Number.isInteger(value)) return `${value}%`;
  return `${Number(value.toFixed(2))}%`;
}

export function mapDbRowToClientIoMilestoneDraft(row: {
  id: string;
  label: string;
  milestone_kind: string;
  percent: number | string | null;
  due_trigger?: string | null;
  due_offset_days?: number | null;
  due_date?: string | null;
  notes?: string | null;
  sort_order: number;
  metadata?: Record<string, unknown> | null;
}): ClientIoMilestoneDraft {
  const metadata = row.metadata ?? {};
  const dueTrigger =
    (row.due_trigger as ClientIoMilestoneDueTrigger | null) ||
    (typeof metadata.due_trigger === "string"
      ? (metadata.due_trigger as ClientIoMilestoneDueTrigger)
      : "custom");
  const dueOffset =
    row.due_offset_days ??
    (typeof metadata.due_offset_days === "number" ? metadata.due_offset_days : null);
  const notes =
    row.notes ??
    (typeof metadata.notes === "string" ? metadata.notes : null);

  return {
    id: row.id,
    label: row.label,
    milestoneKind: (row.milestone_kind as ClientIoMilestoneKind) || "custom",
    percent: Number(row.percent ?? 0),
    dueTrigger,
    dueOffsetDays: dueOffset,
    dueDate: row.due_date ?? null,
    notes,
    sortOrder: Number(row.sort_order ?? 0),
  };
}
