"use client";

import Link from "next/link";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updatePostScheduleAction,
} from "@/features/campaigns/actions/assignment-deliverable-actions";
import { DeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-billing-badge";
import { DeliverableTypeTag } from "@/features/campaigns/components/assignment-hierarchy/deliverable-type-tag";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import { PlatformSelect, DeliverableTypeSelect } from "@/features/campaigns/components/assignment-hierarchy/platform-deliverable-selects";
import { SCHEDULE_STATUS_OPTIONS } from "@/features/campaigns/components/assignment-hierarchy/hierarchy-utils";
import {
  GRID_CELL,
  OPERATIONAL_GRID_LABELS,
} from "@/features/campaigns/components/assignment-hierarchy/operational-grid-columns";
import type { AssignmentPostOperationalRow } from "@/features/campaigns/types/assignment-hierarchy";
import { formatMoney } from "@/features/campaigns/utils";
import { getDeliverableTypeCodesForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { computeVatLine } from "@/lib/vat/calculations";
import { cn } from "@/lib/utils";

type EditablePostRowProps = {
  campaignId: string;
  post: AssignmentPostOperationalRow;
  currency: string;
  readOnly: boolean;
  revenueVatExempt: boolean;
  defaultRevenueVatPercent: number;
  platformOptions: { value: string; label: string }[];
};

type Draft = {
  platform: string;
  deliverable_type: string;
  live_date: string;
  revenue_per_post: number;
  cost_per_post: number;
  revenue_vat_percent: number;
  workflow_status: string;
  billing_status: string;
  notes: string;
};

export function EditablePostRow({
  campaignId,
  post,
  currency,
  readOnly,
  revenueVatExempt,
  defaultRevenueVatPercent,
  platformOptions,
}: EditablePostRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    platform: post.platform,
    deliverable_type: post.deliverable_type,
    live_date: post.live_date ?? "",
    revenue_per_post: post.revenue_per_post,
    cost_per_post: post.cost_per_post,
    revenue_vat_percent: post.revenue_vat_percent || defaultRevenueVatPercent,
    workflow_status: post.workflow_status,
    billing_status: post.billing_status,
    notes: post.notes ?? "",
  }));

  useEffect(() => {
    if (!editing) {
      setDraft({
        platform: post.platform,
        deliverable_type: post.deliverable_type,
        live_date: post.live_date ?? "",
        revenue_per_post: post.revenue_per_post,
        cost_per_post: post.cost_per_post,
        revenue_vat_percent: post.revenue_vat_percent || defaultRevenueVatPercent,
        workflow_status: post.workflow_status,
        billing_status: post.billing_status,
        notes: post.notes ?? "",
      });
    }
  }, [post, editing, defaultRevenueVatPercent]);

  const computedVat = useMemo(() => {
    const revenue = computeVatLine({
      beforeVat: draft.revenue_per_post,
      vatPercent: revenueVatExempt ? 0 : draft.revenue_vat_percent,
      exempt: revenueVatExempt,
    });
    return revenue.vatAmount;
  }, [draft, revenueVatExempt]);

  const collectionLabel =
    post.collection_status === "collected"
      ? "Coll"
      : post.collection_status === "partial"
        ? "Part"
        : post.collection_status === "pending"
          ? "Pend"
          : "—";

  const canEdit = !readOnly && !post.id.startsWith("virtual-");

  function buildSchedulePayload(overrides: Partial<Draft> = {}) {
    const merged = {
      platform: overrides.platform ?? (editing ? draft.platform : post.platform),
      deliverable_type:
        overrides.deliverable_type ??
        (editing ? draft.deliverable_type : post.deliverable_type),
      live_date: overrides.live_date ?? (editing ? draft.live_date : post.live_date ?? ""),
      workflow_status:
        overrides.workflow_status ??
        (editing ? draft.workflow_status : post.workflow_status),
      revenue_per_post:
        overrides.revenue_per_post ??
        (editing ? draft.revenue_per_post : post.revenue_per_post),
      cost_per_post:
        overrides.cost_per_post ?? (editing ? draft.cost_per_post : post.cost_per_post),
      revenue_vat_percent:
        overrides.revenue_vat_percent ??
        (editing
          ? draft.revenue_vat_percent
          : post.revenue_vat_percent || defaultRevenueVatPercent),
      billing_status:
        overrides.billing_status ?? (editing ? draft.billing_status : post.billing_status),
      notes: overrides.notes ?? (editing ? draft.notes : post.notes ?? ""),
    };

    return {
      campaign_id: campaignId,
      schedule_id: post.id,
      live_date: merged.live_date || null,
      status: merged.workflow_status,
      revenue_per_post: merged.revenue_per_post,
      cost_per_post: merged.cost_per_post,
      revenue_vat_percent: merged.revenue_vat_percent,
      notes: merged.notes || null,
      billing_status: merged.billing_status as typeof post.billing_status,
      platform: merged.platform,
      deliverable_type: merged.deliverable_type,
    };
  }

  function persistPostPatch(patch: Partial<Draft>, options?: { closeEdit?: boolean }) {
    if (!canEdit) return;
    startTransition(async () => {
      const result = await updatePostScheduleAction(buildSchedulePayload(patch));
      if (!result.ok) {
        setError(result.message ?? "Failed to save.");
        return;
      }
      if (options?.closeEdit) setEditing(false);
      setError(null);
      router.refresh();
    });
  }

  function save() {
    if (!canEdit) return;
    persistPostPatch({}, { closeEdit: true });
  }

  return (
    <>
      <tr
        className={cn(
          "border-b border-border/30 border-l-2 border-l-primary/20 bg-muted/50 text-[11px] last:border-0",
          editing && "bg-background ring-1 ring-inset ring-primary/20"
        )}
      >
        <td className={cn(GRID_CELL.select, "pl-6")}>
          <span className="text-muted-foreground">└</span>
        </td>
        <td className={cn(GRID_CELL.type, "font-medium")}>{post.label}</td>
        <td className={GRID_CELL.platform}>
          {canEdit ? (
            <PlatformSelect
              platform={editing ? draft.platform : post.platform}
              platformOptions={platformOptions}
              disabled={pending && !editing}
              onPlatformChange={(platform) => {
                const types = getDeliverableTypeCodesForPlatform(platform);
                const deliverableType = types[0] ?? "other";
                if (editing) {
                  setDraft((d) => ({
                    ...d,
                    platform,
                    deliverable_type: deliverableType,
                  }));
                } else {
                  persistPostPatch({ platform, deliverable_type: deliverableType });
                }
              }}
            />
          ) : (
            <DeliverableTypeTag platform={post.platform} deliverableType={post.deliverable_type} />
          )}
        </td>
        <td className={GRID_CELL.deliverableType}>
          {canEdit ? (
            <DeliverableTypeSelect
              platform={editing ? draft.platform : post.platform}
              deliverableType={editing ? draft.deliverable_type : post.deliverable_type}
              disabled={pending && !editing}
              onDeliverableTypeChange={(deliverableType) => {
                if (editing) {
                  setDraft((d) => ({ ...d, deliverable_type: deliverableType }));
                } else {
                  persistPostPatch({ deliverable_type: deliverableType });
                }
              }}
            />
          ) : (
            <span className="text-muted-foreground">{post.deliverable_type_label}</span>
          )}
        </td>
        <td className={GRID_CELL.postDate}>
          {editing ? (
            <Input
              type="date"
              value={draft.live_date}
              onChange={(e) => setDraft((d) => ({ ...d, live_date: e.target.value }))}
              className="h-6 w-full text-[11px]"
            />
          ) : (
            post.live_date ?? "—"
          )}
        </td>
        <td className={GRID_CELL.qty}>1</td>
        <td className={GRID_CELL.money}>
          {editing ? (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.revenue_per_post}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  revenue_per_post: Number(e.target.value) || 0,
                }))
              }
              className="h-6 w-full text-right text-[11px]"
            />
          ) : (
            formatMoney(post.revenue_per_post, currency)
          )}
        </td>
        <td className={GRID_CELL.money}>
          {editing ? (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.cost_per_post}
              onChange={(e) =>
                setDraft((d) => ({ ...d, cost_per_post: Number(e.target.value) || 0 }))
              }
              className="h-6 w-full text-right text-[11px]"
            />
          ) : (
            formatMoney(post.cost_per_post, currency)
          )}
        </td>
        <td className={cn(GRID_CELL.money, "font-medium")}>
          {formatMoney(editing ? draft.revenue_per_post : post.revenue_per_post, currency)}
        </td>
        <td className={GRID_CELL.money}>
          {formatMoney(editing ? draft.cost_per_post : post.cost_per_post, currency)}
        </td>
        <td className={GRID_CELL.vat}>
          {editing && !revenueVatExempt ? (
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={draft.revenue_vat_percent}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  revenue_vat_percent: Number(e.target.value) || 0,
                }))
              }
              className="h-6 w-full text-right text-[11px]"
            />
          ) : revenueVatExempt ? (
            "Ex"
          ) : (
            formatMoney(editing ? computedVat : post.revenue_vat_amount, currency)
          )}
        </td>
        <td className={GRID_CELL.status}>
          {editing ? (
            <Select
              value={draft.billing_status}
              onValueChange={(v) => setDraft((d) => ({ ...d, billing_status: v }))}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ready_to_invoice">Ready</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <DeliverableBillingBadge status={post.billing_status} />
          )}
        </td>
        <td className={GRID_CELL.invoice}>
          {post.invoice_document_number ? (
            <Link href={`/billing/invoices/${post.invoice_id}`} className="font-mono text-[10px] hover:underline">
              {post.invoice_document_number}
            </Link>
          ) : (
            "—"
          )}
        </td>
        <td className={GRID_CELL.collection}>{collectionLabel}</td>
        <td className={GRID_CELL.payout}>
          {post.payout_status ? (
            <Badge variant="secondary" className="text-[9px] font-normal">
              {post.payout_status.replace(/_/g, " ")}
            </Badge>
          ) : (
            "—"
          )}
        </td>
        <td className={GRID_CELL.workflow}>
          {editing ? (
            <Select value={draft.workflow_status} onValueChange={(v) => setDraft((d) => ({ ...d, workflow_status: v }))}>
              <SelectTrigger className="h-6 text-[10px]">
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
            <DeliverableWorkflowBadge status={post.workflow_status} />
          )}
        </td>
        <td className={GRID_CELL.notes}>
          {editing ? (
            <Input
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              className="h-6 text-[10px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <span className="line-clamp-1 text-[10px] text-muted-foreground">{post.notes ?? "—"}</span>
          )}
        </td>
        <td className={GRID_CELL.actions}>
          {!canEdit ? (
            <span className="text-[9px] text-muted-foreground">—</span>
          ) : editing ? (
            <div className="flex justify-end gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="size-6" onClick={save} disabled={pending}>
                <CheckIcon className="size-3" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setEditing(false)}>
                <XIcon className="size-3" />
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setEditing(true)}>
              <PencilIcon className="size-3" />
            </Button>
          )}
        </td>
      </tr>
      {error ? (
        <tr>
          <td colSpan={18} className="px-4 pb-1 text-[10px] text-destructive">
            {error}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function OperationalGridHeader() {
  return (
    <tr className="border-b border-border/50 text-left text-[9px] uppercase tracking-wide text-muted-foreground">
      <th className={GRID_CELL.select} />
      <th className={GRID_CELL.type}>{OPERATIONAL_GRID_LABELS.type}</th>
      <th className={GRID_CELL.platform}>{OPERATIONAL_GRID_LABELS.platform}</th>
      <th className={GRID_CELL.deliverableType}>{OPERATIONAL_GRID_LABELS.deliverableType}</th>
      <th className={GRID_CELL.postDate}>{OPERATIONAL_GRID_LABELS.postDate}</th>
      <th className={cn(GRID_CELL.qty, "text-right")}>{OPERATIONAL_GRID_LABELS.qty}</th>
      <th className={GRID_CELL.money}>{OPERATIONAL_GRID_LABELS.revPerAd}</th>
      <th className={GRID_CELL.money}>{OPERATIONAL_GRID_LABELS.costPerAd}</th>
      <th className={GRID_CELL.money}>{OPERATIONAL_GRID_LABELS.rev}</th>
      <th className={GRID_CELL.money}>{OPERATIONAL_GRID_LABELS.cost}</th>
      <th className={GRID_CELL.vat}>{OPERATIONAL_GRID_LABELS.vat}</th>
      <th className={GRID_CELL.status}>{OPERATIONAL_GRID_LABELS.billing}</th>
      <th className={GRID_CELL.invoice}>{OPERATIONAL_GRID_LABELS.invoice}</th>
      <th className={GRID_CELL.collection}>{OPERATIONAL_GRID_LABELS.collection}</th>
      <th className={GRID_CELL.payout}>{OPERATIONAL_GRID_LABELS.payout}</th>
      <th className={GRID_CELL.workflow}>{OPERATIONAL_GRID_LABELS.workflow}</th>
      <th className={GRID_CELL.notes}>{OPERATIONAL_GRID_LABELS.notes}</th>
      <th className={GRID_CELL.actions} />
    </tr>
  );
}
