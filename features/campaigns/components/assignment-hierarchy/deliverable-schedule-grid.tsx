"use client";

import { format } from "date-fns";
import { useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePostScheduleAction } from "@/features/campaigns/actions/assignment-deliverable-actions";
import { SCHEDULE_STATUS_OPTIONS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { AssignmentScheduleChip } from "@/features/campaigns/types/assignment-hierarchy";
import { cn } from "@/lib/utils";

type DeliverableScheduleGridProps = {
  campaignId: string;
  schedules: AssignmentScheduleChip[];
  disabled?: boolean;
};

export function DeliverableScheduleGrid({
  campaignId,
  schedules,
  disabled,
}: DeliverableScheduleGridProps) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftStatus, setDraftStatus] = useState("draft");

  if (schedules.length === 0) {
    return null;
  }

  function beginEdit(schedule: AssignmentScheduleChip) {
    if (disabled) return;
    setEditingId(schedule.id);
    setDraftDate(schedule.live_date ?? "");
    setDraftStatus(schedule.status);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(scheduleId: string) {
    startTransition(async () => {
      await updatePostScheduleAction({
        campaign_id: campaignId,
        schedule_id: scheduleId,
        live_date: draftDate || null,
        status: draftStatus,
      });
      setEditingId(null);
    });
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-background/60">
      <table className="w-full min-w-[320px] text-xs">
        <thead>
          <tr className="border-b border-border/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">Date</th>
            <th className="px-2 py-1.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const isEditing = editingId === schedule.id;
            return (
              <tr
                key={schedule.id}
                className={cn(
                  "border-b border-border/30 last:border-0",
                  !disabled && "cursor-pointer hover:bg-muted/40"
                )}
                onClick={() => !isEditing && beginEdit(schedule)}
              >
                <td className="px-2 py-1.5 font-mono text-muted-foreground">
                  #{schedule.sequence_number}
                </td>
                <td className="px-2 py-1.5">
                  {isEditing ? (
                    <Input
                      type="date"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      className="h-7 text-xs"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(schedule.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                  ) : schedule.live_date ? (
                    format(new Date(`${schedule.live_date}T00:00:00`), "d MMM yyyy")
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {isEditing ? (
                    <Select
                      value={draftStatus}
                      onValueChange={setDraftStatus}
                    >
                      <SelectTrigger
                        className="h-7 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHEDULE_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="capitalize">
                      {schedule.status.replace(/_/g, " ")}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pending ? (
        <p className="px-2 py-1 text-[10px] text-muted-foreground">Saving schedule…</p>
      ) : null}
      {editingId ? (
        <div className="flex gap-2 border-t border-border/40 px-2 py-1.5">
          <button
            type="button"
            className="text-[10px] font-medium text-primary hover:underline"
            onClick={() => saveEdit(editingId)}
          >
            Save (Enter)
          </button>
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:underline"
            onClick={cancelEdit}
          >
            Cancel (Esc)
          </button>
        </div>
      ) : null}
    </div>
  );
}
