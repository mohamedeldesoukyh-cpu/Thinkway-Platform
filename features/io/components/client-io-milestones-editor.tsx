"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailFormSection,
} from "@/features/campaigns/components/operational-detail-panel";
import { saveClientIoMilestonesAction } from "@/features/io/actions";
import type { ClientIoStatus } from "@/features/io/types";
import {
  buildClientIoMilestoneTemplate,
  CLIENT_IO_MILESTONE_DUE_TRIGGER_LABELS,
  CLIENT_IO_MILESTONE_TEMPLATE_OPTIONS,
  isClientIoMilestoneEditable,
  type ClientIoMilestoneDraft,
  type ClientIoMilestoneDueTrigger,
  type ClientIoMilestoneTemplateId,
} from "@/lib/io/client-io-milestones";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  clientIoId: string;
  campaignHeaderId: string;
  status: ClientIoStatus;
  isSuperseded?: boolean;
  milestones: ClientIoMilestoneDraft[];
};

const DUE_TRIGGERS = Object.keys(
  CLIENT_IO_MILESTONE_DUE_TRIGGER_LABELS
) as ClientIoMilestoneDueTrigger[];

export function ClientIoMilestonesEditor({
  clientIoId,
  campaignHeaderId,
  status,
  isSuperseded = false,
  milestones: initialMilestones,
}: Props) {
  const editable = isClientIoMilestoneEditable(status, isSuperseded);
  const [rows, setRows] = useState<ClientIoMilestoneDraft[]>(initialMilestones);
  const [saveState, saveAction, saving] = useActionState(
    saveClientIoMilestonesAction,
    INITIAL_STATE
  );

  useEffect(() => {
    setRows(initialMilestones);
  }, [initialMilestones]);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  const totalPercent = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.percent || 0), 0),
    [rows]
  );

  const payload = useMemo(() => JSON.stringify(rows), [rows]);

  function applyTemplate(templateId: ClientIoMilestoneTemplateId) {
    setRows(buildClientIoMilestoneTemplate(templateId));
  }

  function updateRow(index: number, patch: Partial<ClientIoMilestoneDraft>) {
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        label: "",
        milestoneKind: "custom",
        percent: Math.max(0, Number((100 - totalPercent).toFixed(2))),
        dueTrigger: "custom",
        dueOffsetDays: null,
        dueDate: null,
        notes: null,
        sortOrder: prev.length + 1,
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <DetailFormSection label="Billing milestones" className="py-3.5">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Configure the payment schedule for this Client IO. This is schedule ownership only —
          invoices are created in Release 2.3. Percentages must total 100%.
        </p>

        {editable ? (
          <div className="flex flex-wrap gap-2">
            {CLIENT_IO_MILESTONE_TEMPLATE_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant="outline"
                title={option.description}
                onClick={() => applyTemplate(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Milestone schedule is locked after send. Create an amendment to revise it.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            No milestones configured. Apply a template or add a custom row.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li
                key={row.id ?? `draft-${index}`}
                className="space-y-2 rounded-md border border-border/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Sequence {index + 1}
                  </p>
                  {editable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRow(index)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] text-muted-foreground">Description</span>
                    <Input
                      value={row.label}
                      disabled={!editable || saving}
                      onChange={(event) => updateRow(index, { label: event.target.value })}
                      className={DETAIL_FORM_INPUT_CLASS}
                      placeholder="e.g. 50% at kickoff"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Percentage</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.percent}
                      disabled={!editable || saving}
                      onChange={(event) =>
                        updateRow(index, { percent: Number(event.target.value) })
                      }
                      className={DETAIL_FORM_INPUT_CLASS}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Due trigger</span>
                    <select
                      value={row.dueTrigger}
                      disabled={!editable || saving}
                      onChange={(event) =>
                        updateRow(index, {
                          dueTrigger: event.target.value as ClientIoMilestoneDueTrigger,
                        })
                      }
                      className={DETAIL_FORM_INPUT_CLASS}
                    >
                      {DUE_TRIGGERS.map((trigger) => (
                        <option key={trigger} value={trigger}>
                          {CLIENT_IO_MILESTONE_DUE_TRIGGER_LABELS[trigger]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">
                      Due offset (days)
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={row.dueOffsetDays ?? ""}
                      disabled={!editable || saving}
                      onChange={(event) =>
                        updateRow(index, {
                          dueOffsetDays:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                      className={DETAIL_FORM_INPUT_CLASS}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Due date</span>
                    <Input
                      type="date"
                      value={row.dueDate ?? ""}
                      disabled={!editable || saving}
                      onChange={(event) =>
                        updateRow(index, { dueDate: event.target.value || null })
                      }
                      className={DETAIL_FORM_INPUT_CLASS}
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[11px] text-muted-foreground">Notes</span>
                    <Input
                      value={row.notes ?? ""}
                      disabled={!editable || saving}
                      onChange={(event) =>
                        updateRow(index, { notes: event.target.value || null })
                      }
                      className={DETAIL_FORM_INPUT_CLASS}
                      placeholder="Optional notes"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            className={`text-xs ${
              Math.abs(totalPercent - 100) < 0.01 || rows.length === 0
                ? "text-muted-foreground"
                : "text-amber-800 dark:text-amber-200"
            }`}
          >
            Total {totalPercent.toFixed(2)}%
            {rows.length === 0
              ? " · empty schedule allowed until save with rows"
              : Math.abs(totalPercent - 100) < 0.01
                ? " · valid"
                : " · must equal 100%"}
          </p>
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={addRow}>
                Add milestone
              </Button>
              <form action={saveAction}>
                <input type="hidden" name="id" value={clientIoId} />
                <input type="hidden" name="campaign_header_id" value={campaignHeaderId} />
                <input type="hidden" name="milestones" value={payload} />
                <Button type="submit" size="sm" variant="outline" disabled={saving}>
                  {saving ? "Saving…" : "Save milestones"}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </DetailFormSection>
  );
}
