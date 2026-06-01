"use client";

import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DELIVERABLE_TYPE_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import {
  PLATFORM_DELIVERABLES,
  deliverableLabel,
  platformLabel,
} from "@/features/campaigns/line-assignment";
import {
  createEmptyCommercialRow,
  duplicateCommercialRow,
  rowTotalCost,
  rowTotalRevenue,
  type CommercialDeliverableRow,
} from "@/lib/assignments/commercial-calculations";
import { cn } from "@/lib/utils";

type DeliverablePricingEditorProps = {
  rows: CommercialDeliverableRow[];
  onChange: (rows: CommercialDeliverableRow[]) => void;
  currency: string;
  disabled?: boolean;
};

export function DeliverablePricingEditor({
  rows,
  onChange,
  currency,
  disabled,
}: DeliverablePricingEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<CommercialDeliverableRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onChange([...rows, createEmptyCommercialRow()]);
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  function duplicateRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    onChange([...rows, duplicateCommercialRow(row)]);
  }

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function expandSchedule(row: CommercialDeliverableRow) {
    const schedules = Array.from({ length: row.quantity }, (_, i) => ({
      sequence: i + 1,
      live_date: row.live_date,
      notes: row.notes,
      status: "draft",
    }));
    updateRow(row.id, { schedule_mode: "expanded", post_schedules: schedules });
    setExpandedId(row.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Deliverable commercial rows</p>
          <p className="text-xs text-muted-foreground">
            Per-deliverable pricing with optional expanded posting schedules.{" "}
            <span className="hidden sm:inline">Press Alt+N to add a row.</span>
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={disabled}>
          <PlusIcon data-icon="inline-start" />
          Add row
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No deliverable rows yet. Add rows to define platform, quantity, cost, revenue, and live dates.
        </p>
      ) : (
        rows.map((row, index) => {
          const totalCost = rowTotalCost(row);
          const totalRevenue = rowTotalRevenue(row);
          const deliverableOptions =
            PLATFORM_DELIVERABLES[row.platform] ?? PLATFORM_DELIVERABLES.other;
          const isExpanded = expandedId === row.id;

          return (
            <div
              key={row.id}
              className="rounded-2xl border bg-card shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-medium"
                  onClick={() => toggleExpanded(row.id)}
                  disabled={disabled}
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="size-4" />
                  ) : (
                    <ChevronRightIcon className="size-4" />
                  )}
                  Row {index + 1}
                </button>
                <Badge variant="outline">{platformLabel(row.platform)}</Badge>
                <Badge variant="secondary">{deliverableLabel(row.deliverable_type)}</Badge>
                <Badge variant="outline">×{row.quantity}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {currency} {totalCost.toLocaleString()} cost · {totalRevenue.toLocaleString()} rev
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => duplicateRow(row.id)}
                  disabled={disabled}
                  title="Duplicate row (Alt+D)"
                >
                  <CopyIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(row.id)}
                  disabled={disabled}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>

              <div className={cn("grid gap-3 p-3", !isExpanded && "hidden")}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <FieldSelect
                    label="Platform"
                    value={row.platform}
                    onChange={(v) => {
                      const types = PLATFORM_DELIVERABLES[v] ?? PLATFORM_DELIVERABLES.other;
                      updateRow(row.id, {
                        platform: v,
                        deliverable_type: types[0] ?? "other",
                      });
                    }}
                    options={PLATFORM_OPTIONS.filter((p) => p.value !== "multi")}
                    disabled={disabled}
                  />
                  <FieldSelect
                    label="Deliverable type"
                    value={row.deliverable_type}
                    onChange={(v) => updateRow(row.id, { deliverable_type: v })}
                    options={deliverableOptions.map((d) => ({
                      value: d,
                      label: deliverableLabel(d),
                    }))}
                    disabled={disabled}
                  />
                  <NumberField
                    label="Quantity"
                    value={row.quantity}
                    onChange={(v) => updateRow(row.id, { quantity: Math.max(1, v) })}
                    disabled={disabled}
                    min={1}
                  />
                  <NumberField
                    label="Unit cost"
                    value={row.unit_cost}
                    onChange={(v) => updateRow(row.id, { unit_cost: v })}
                    disabled={disabled}
                  />
                  <NumberField
                    label="Unit revenue"
                    value={row.revenue_before_vat}
                    onChange={(v) => updateRow(row.id, { revenue_before_vat: v })}
                    disabled={disabled}
                  />
                  <div className="grid gap-2">
                    <Label>Live date</Label>
                    <Input
                      type="date"
                      value={row.live_date ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, { live_date: e.target.value || null })
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      rows={2}
                      value={row.notes ?? ""}
                      onChange={(e) => updateRow(row.id, { notes: e.target.value || null })}
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => expandSchedule(row)}
                    disabled={disabled || row.quantity < 2}
                  >
                    <CalendarIcon data-icon="inline-start" />
                    Expand schedule ({row.quantity} posts)
                  </Button>
                  {row.schedule_mode === "expanded" && row.post_schedules.length > 0 ? (
                    <Badge variant="secondary">Expanded schedule active</Badge>
                  ) : null}
                </div>

                {row.schedule_mode === "expanded" && row.post_schedules.length > 0 ? (
                  <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Individual posting schedule
                    </p>
                    {row.post_schedules.map((slot) => (
                      <div
                        key={slot.sequence}
                        className="grid gap-2 sm:grid-cols-[auto_1fr_1fr]"
                      >
                        <span className="pt-2 text-sm font-medium">#{slot.sequence}</span>
                        <Input
                          type="date"
                          value={slot.live_date ?? ""}
                          onChange={(e) => {
                            const next = row.post_schedules.map((s) =>
                              s.sequence === slot.sequence
                                ? { ...s, live_date: e.target.value || null }
                                : s
                            );
                            updateRow(row.id, { post_schedules: next });
                          }}
                          disabled={disabled}
                        />
                        <Input
                          placeholder="Posting notes"
                          value={slot.notes ?? ""}
                          onChange={(e) => {
                            const next = row.post_schedules.map((s) =>
                              s.sequence === slot.sequence
                                ? { ...s, notes: e.target.value || null }
                                : s
                            );
                            updateRow(row.id, { post_schedules: next });
                          }}
                          disabled={disabled}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[] | { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={disabled}
      />
    </div>
  );
}
