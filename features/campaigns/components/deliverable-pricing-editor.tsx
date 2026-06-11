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
import { DeliverableTypeTag } from "@/features/campaigns/components/assignment-hierarchy/deliverable-type-tag";
import {
  DeliverableTypeSelect,
  PlatformBadge,
  PlatformSelect,
} from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import { SCHEDULE_STATUS_OPTIONS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import type { LineInfluencerAssignment } from "@/features/campaigns/line-assignment";
import {
  createEmptyCommercialRow,
  duplicateCommercialRow,
  rowTotalCost,
  rowTotalRevenue,
  type CommercialDeliverableRow,
} from "@/lib/assignments/commercial-calculations";
import {
  getCreatorConnectedPlatformOptions,
  getDeliverableTypeCodesForPlatform,
  deliverableTypeShortLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
import { cn } from "@/lib/utils";

type DeliverablePricingEditorProps = {
  rows: CommercialDeliverableRow[];
  onChange: (rows: CommercialDeliverableRow[]) => void;
  currency: string;
  disabled?: boolean;
  assignment?: LineInfluencerAssignment | null;
  creatorPlatformAccounts?: readonly { platform: string }[];
};

export function DeliverablePricingEditor({
  rows,
  onChange,
  currency,
  disabled,
  assignment,
  creatorPlatformAccounts,
}: DeliverablePricingEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const platformOptions = getCreatorConnectedPlatformOptions({
    creatorPlatformAccounts,
    assignment,
  });

  function updateRow(id: string, patch: Partial<CommercialDeliverableRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    const defaultPlatform = platformOptions[0]?.value ?? "instagram";
    onChange([...rows, createEmptyCommercialRow(defaultPlatform)]);
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
      platform: row.platform,
      deliverable_type: row.deliverable_type,
      revenue_per_post: row.revenue_before_vat,
      cost_per_post: row.unit_cost,
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
            Per-deliverable pricing with optional expanded posting schedules. Alt+N to add.
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
          const isExpanded = expandedId === row.id;

          return (
            <div key={row.id} className="rounded-xl border bg-card shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
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
                  {deliverableTypeShortLabel(row.deliverable_type)}
                </button>
                <PlatformBadge platform={row.platform} />
                <DeliverableTypeTag platform={row.platform} deliverableType={row.deliverable_type} />
                <Badge variant="outline" className="text-[10px]">
                  Qty {row.quantity}
                </Badge>
                <div className="ml-auto flex items-center gap-0.5">
                  <span className="mr-2 hidden text-[11px] text-muted-foreground sm:inline">
                    {currency} {totalCost.toLocaleString()} cost · {totalRevenue.toLocaleString()} rev
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => duplicateRow(row.id)}
                    disabled={disabled}
                    title="Duplicate row"
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
              </div>

              <div className={cn("space-y-3 p-3", !isExpanded && "hidden")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Platform</Label>
                    <PlatformSelect
                      platform={row.platform}
                      platformOptions={platformOptions}
                      disabled={disabled}
                      className="h-8 w-full max-w-none"
                      onPlatformChange={(platform) => {
                        const types = getDeliverableTypeCodesForPlatform(platform);
                        updateRow(row.id, {
                          platform,
                          deliverable_type: types[0] ?? "other",
                        });
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Deliverable type</Label>
                    <DeliverableTypeSelect
                      platform={row.platform}
                      deliverableType={row.deliverable_type}
                      disabled={disabled}
                      className="h-8 w-full max-w-none min-w-0"
                      onDeliverableTypeChange={(deliverableType) =>
                        updateRow(row.id, { deliverable_type: deliverableType })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <NumberField
                    label="Qty"
                    value={row.quantity}
                    onChange={(v) => updateRow(row.id, { quantity: Math.max(1, v) })}
                    disabled={disabled}
                    min={1}
                  />
                  <NumberField
                    label="Rev/ad"
                    value={row.revenue_before_vat}
                    onChange={(v) => updateRow(row.id, { revenue_before_vat: v })}
                    disabled={disabled}
                  />
                  <NumberField
                    label="Cost/ad"
                    value={row.unit_cost}
                    onChange={(v) => updateRow(row.id, { unit_cost: v })}
                    disabled={disabled}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <NumberField
                    label="UR"
                    value={row.usage_rights_amount ?? 0}
                    onChange={(v) => updateRow(row.id, { usage_rights_amount: v })}
                    disabled={disabled}
                  />
                  <NumberField
                    label="AF %"
                    value={row.agency_fee_percent ?? 0}
                    onChange={(v) => updateRow(row.id, { agency_fee_percent: Math.min(100, v) })}
                    disabled={disabled}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Posting start date</Label>
                    <Input
                      type="date"
                      value={row.live_date ?? ""}
                      onChange={(e) =>
                        updateRow(row.id, { live_date: e.target.value || null })
                      }
                      disabled={disabled}
                      className="h-8"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">WF</Label>
                    <Select
                      value={row.post_schedules[0]?.status ?? "draft"}
                      onValueChange={(status) => {
                        const schedules =
                          row.post_schedules.length > 0
                            ? row.post_schedules.map((s) => ({ ...s, status }))
                            : [{ sequence: 1, live_date: row.live_date, status, notes: row.notes }];
                        updateRow(row.id, { post_schedules: schedules });
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8">
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
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={2}
                    value={row.notes ?? ""}
                    onChange={(e) => updateRow(row.id, { notes: e.target.value || null })}
                    disabled={disabled}
                    className="text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => expandSchedule(row)}
                    disabled={disabled || row.quantity < 2}
                  >
                    <CalendarIcon data-icon="inline-start" className="size-3" />
                    Expand schedule ({row.quantity} posts)
                  </Button>
                  {row.schedule_mode === "expanded" && row.post_schedules.length > 0 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Expanded schedule active
                    </Badge>
                  ) : null}
                </div>

                {row.schedule_mode === "expanded" && row.post_schedules.length > 0 ? (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Individual posting schedule
                    </p>
                    {row.post_schedules.map((slot) => (
                      <div
                        key={slot.sequence}
                        className="space-y-2 rounded-md border border-l-2 border-l-primary/20 bg-muted/50 p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">#{slot.sequence}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="grid gap-1">
                            <Label className="text-[10px]">Platform</Label>
                            <PlatformSelect
                              platform={slot.platform ?? row.platform}
                              platformOptions={platformOptions}
                              disabled={disabled}
                              className="h-7 w-full max-w-none"
                              onPlatformChange={(platform) => {
                                const types = getDeliverableTypeCodesForPlatform(platform);
                                const next = row.post_schedules.map((s) =>
                                  s.sequence === slot.sequence
                                    ? {
                                        ...s,
                                        platform,
                                        deliverable_type: types[0] ?? s.deliverable_type,
                                      }
                                    : s
                                );
                                updateRow(row.id, { post_schedules: next });
                              }}
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[10px]">Deliverable</Label>
                            <DeliverableTypeSelect
                              platform={slot.platform ?? row.platform}
                              deliverableType={slot.deliverable_type ?? row.deliverable_type}
                              disabled={disabled}
                              className="h-7 w-full max-w-none min-w-0"
                              onDeliverableTypeChange={(deliverableType) => {
                                const next = row.post_schedules.map((s) =>
                                  s.sequence === slot.sequence
                                    ? { ...s, deliverable_type: deliverableType }
                                    : s
                                );
                                updateRow(row.id, { post_schedules: next });
                              }}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <NumberField
                            label="Rev/ad"
                            value={slot.revenue_per_post ?? row.revenue_before_vat}
                            onChange={(v) => {
                              const next = row.post_schedules.map((s) =>
                                s.sequence === slot.sequence ? { ...s, revenue_per_post: v } : s
                              );
                              updateRow(row.id, { post_schedules: next });
                            }}
                            disabled={disabled}
                          />
                          <NumberField
                            label="Cost/ad"
                            value={slot.cost_per_post ?? row.unit_cost}
                            onChange={(v) => {
                              const next = row.post_schedules.map((s) =>
                                s.sequence === slot.sequence ? { ...s, cost_per_post: v } : s
                              );
                              updateRow(row.id, { post_schedules: next });
                            }}
                            disabled={disabled}
                          />
                          <NumberField
                            label="VAT %"
                            value={slot.revenue_vat_percent ?? 0}
                            onChange={(v) => {
                              const next = row.post_schedules.map((s) =>
                                s.sequence === slot.sequence
                                  ? { ...s, revenue_vat_percent: v }
                                  : s
                              );
                              updateRow(row.id, { post_schedules: next });
                            }}
                            disabled={disabled}
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="grid gap-1">
                            <Label className="text-[10px]">Posting date</Label>
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
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[10px]">WF</Label>
                            <Select
                              value={slot.status ?? "draft"}
                              onValueChange={(status) => {
                                const next = row.post_schedules.map((s) =>
                                  s.sequence === slot.sequence ? { ...s, status } : s
                                );
                                updateRow(row.id, { post_schedules: next });
                              }}
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-7 text-xs">
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
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-[10px]">Notes</Label>
                          <Input
                            placeholder="Notes"
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
                            className="h-7 text-xs"
                          />
                        </div>
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
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={disabled}
        className="h-8"
      />
    </div>
  );
}
