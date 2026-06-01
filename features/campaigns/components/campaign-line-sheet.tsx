"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createCampaignLineAction,
  updateCampaignLineAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import {
  CAMPAIGN_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import type { CampaignStatus } from "@/types/database";

type CampaignLineSheetProps = {
  campaignId: string;
  currencyCode: string;
  line: CampaignLineWorkspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignLineSheet({
  campaignId,
  currencyCode,
  line,
  open,
  onOpenChange,
}: CampaignLineSheetProps) {
  const isEdit = line !== null;
  const [status, setStatus] = useState<CampaignStatus>(line?.status ?? "draft");
  const [platform, setPlatform] = useState(line?.platform ?? "");
  const [currency, setCurrency] = useState(line?.currency_code ?? currencyCode);

  const [createState, createAction, createPending] = useActionState(
    createCampaignLineAction,
    { ok: false }
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateCampaignLineAction,
    { ok: false } satisfies FormActionState
  );

  const state = isEdit ? updateState : createState;
  const formAction = isEdit ? updateAction : createAction;
  const isPending = isEdit ? updatePending : createPending;

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setStatus(line?.status ?? "draft");
    setPlatform(line?.platform ?? "");
    setCurrency(line?.currency_code ?? currencyCode);
  }, [open, line, currencyCode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit line" : "Add campaign line"}</SheetTitle>
          <SheetDescription>
            Manage line-level PO, revenue, cost, and platform.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          <input type="hidden" name="campaign_id" value={campaignId} />
          {isEdit ? <input type="hidden" name="line_id" value={line.id} /> : null}
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="currency_code" value={currency} />

          <div className="grid gap-2">
            <Label htmlFor="line_name">Line name</Label>
            <Input
              id="line_name"
              name="name"
              defaultValue={line?.name ?? ""}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Platform</Label>
              <SearchableSelect
                value={platform}
                onValueChange={setPlatform}
                options={PLATFORM_OPTIONS.map((o) => ({
                  value: o.value,
                  label: o.label,
                }))}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CampaignStatus)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="po_amount">PO amount</Label>
              <Input
                id="po_amount"
                name="po_amount"
                type="number"
                min={0}
                step="0.01"
                defaultValue={line?.po_amount ?? 0}
                required
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revenue">Revenue</Label>
              <Input
                id="revenue"
                name="revenue"
                type="number"
                min={0}
                step="0.01"
                defaultValue={line?.revenue ?? 0}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost">Cost</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                min={0}
                step="0.01"
                defaultValue={line?.cost ?? 0}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save line" : "Add line"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
