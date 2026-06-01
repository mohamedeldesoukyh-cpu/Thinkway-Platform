"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { InfluencerTypeahead } from "@/components/forms/influencer-typeahead";
import { FieldError } from "@/components/forms/field-error";
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
  buildInitialSelections,
  PlatformAccountSelector,
  type PlatformSelectionState,
} from "@/features/campaigns/components/platform-account-selector";
import {
  ASSIGNMENT_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/features/campaigns/constants";
import {
  buildLineTitle,
  countLineDeliverables,
  suggestCostFromRateCard,
} from "@/features/campaigns/line-assignment";
import type {
  CampaignLineAssignmentStatus,
  CampaignLineWorkspace,
  InfluencerAssignmentProfile,
  InfluencerSearchResult,
} from "@/features/campaigns/types";

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
  const [assignmentStatus, setAssignmentStatus] =
    useState<CampaignLineAssignmentStatus>(line?.assignment_status ?? "assigned");
  const [currency, setCurrency] = useState(line?.currency_code ?? currencyCode);
  const [influencerId, setInfluencerId] = useState(line?.influencer_id ?? "");
  const [influencerLabel, setInfluencerLabel] = useState(
    line?.influencer_name ?? null
  );
  const [profile, setProfile] = useState<InfluencerAssignmentProfile | null>(null);
  const [selections, setSelections] = useState<PlatformSelectionState[]>([]);
  const [lineTitle, setLineTitle] = useState(line?.name ?? "");
  const [titleEdited, setTitleEdited] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [cost, setCost] = useState(line?.cost ?? 0);
  const [revenue, setRevenue] = useState(line?.revenue ?? 0);
  const [poAmount, setPoAmount] = useState(line?.po_amount ?? 0);
  const [startDate, setStartDate] = useState(line?.start_date ?? "");
  const [endDate, setEndDate] = useState(line?.end_date ?? "");

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

  const activeSelections = useMemo(
    () =>
      selections.filter((s) => s.selected && s.deliverables.length > 0),
    [selections]
  );

  const assignmentJson = useMemo(
    () =>
      JSON.stringify({
        platforms: activeSelections.map(
          ({ selected: _s, ...rest }) => rest
        ),
      }),
    [activeSelections]
  );

  const autoTitle = useMemo(() => {
    if (!influencerLabel || activeSelections.length === 0) return "";
    return buildLineTitle(
      influencerLabel,
      activeSelections.map(({ selected: _s, ...rest }) => rest)
    );
  }, [influencerLabel, activeSelections]);

  useEffect(() => {
    if (!titleEdited && autoTitle) {
      setLineTitle(autoTitle);
    }
  }, [autoTitle, titleEdited]);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  async function loadProfile(id: string, existing?: PlatformSelectionState[]) {
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/campaigns/influencers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as {
        profile?: InfluencerAssignmentProfile;
        error?: string;
      };
      if (!data.profile) {
        toast.error(data.error ?? "Failed to load creator profile.");
        return;
      }
      setProfile(data.profile);
      setSelections(buildInitialSelections(data.profile, existing));
      setCurrency(data.profile.suggested_currency || currencyCode);
      setCost((c) => (c > 0 ? c : data.profile!.suggested_cost));
    } finally {
      setLoadingProfile(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setAssignmentStatus(line?.assignment_status ?? "assigned");
    setCurrency(line?.currency_code ?? currencyCode);
    setInfluencerId(line?.influencer_id ?? "");
    setInfluencerLabel(line?.influencer_name ?? null);
    setLineTitle(line?.name ?? "");
    setTitleEdited(line?.assignment?.title_user_edited ?? false);
    setCost(line?.cost ?? 0);
    setRevenue(line?.revenue ?? 0);
    setPoAmount(line?.po_amount ?? 0);
    setStartDate(line?.start_date ?? "");
    setEndDate(line?.end_date ?? "");
    setProfile(null);
    setSelections([]);

    if (line?.influencer_id) {
      const existing = line.assignment?.platforms.map((p) => ({
        ...p,
        selected: true,
      }));
      void loadProfile(line.influencer_id, existing);
    }
  }, [open, line, currencyCode]);

  function onInfluencerPick(item: InfluencerSearchResult) {
    setInfluencerId(item.id);
    setInfluencerLabel(item.display_name);
    setTitleEdited(false);
    void loadProfile(item.id);
  }

  useEffect(() => {
    if (!profile || activeSelections.length === 0) return;
    const suggested = suggestCostFromRateCard(profile.rate_card, activeSelections);
    if (cost === 0 && suggested > 0) {
      setCost(suggested);
    }
  }, [profile, activeSelections, cost]);

  const canSubmit =
    Boolean(influencerId) &&
    activeSelections.length > 0 &&
    !loadingProfile &&
    lineTitle.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit influencer assignment" : "Assign influencer"}
          </SheetTitle>
          <SheetDescription>
            Select a creator, choose platform accounts and deliverables, then set
            commercial terms. Line title is generated automatically.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-5 px-6 pb-6">
          <input type="hidden" name="campaign_id" value={campaignId} />
          {isEdit ? <input type="hidden" name="line_id" value={line.id} /> : null}
          <input type="hidden" name="influencer_id" value={influencerId} />
          <input type="hidden" name="assignment_json" value={assignmentJson} />
          <input type="hidden" name="assignment_status" value={assignmentStatus} />
          <input type="hidden" name="currency_code" value={currency} />
          <input type="hidden" name="name" value={lineTitle} />
          <input
            type="hidden"
            name="title_user_edited"
            value={titleEdited ? "1" : "0"}
          />
          <input type="hidden" name="start_date" value={startDate} />
          <input type="hidden" name="end_date" value={endDate} />

          <InfluencerTypeahead
            value={influencerId}
            selectedLabel={influencerLabel}
            onSelect={onInfluencerPick}
            disabled={isPending || Boolean(line?.vendor_assignment_locked)}
          />
          <FieldError messages={state.fieldErrors?.influencer_id} />

          {loadingProfile ? (
            <p className="text-sm text-muted-foreground">Loading creator profile…</p>
          ) : profile ? (
            <PlatformAccountSelector
              profile={profile}
              selections={selections}
              onChange={setSelections}
              disabled={isPending || Boolean(line?.vendor_assignment_locked)}
            />
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="line_title">Assignment title</Label>
            <Input
              id="line_title"
              value={lineTitle}
              onChange={(e) => {
                setLineTitle(e.target.value);
                setTitleEdited(true);
              }}
              placeholder={autoTitle || "Auto-generated from creator + platforms"}
              disabled={isPending}
              required
            />
            <p className="text-xs text-muted-foreground">
              Auto-generated — edit if needed.{" "}
              {activeSelections.length > 0
                ? `${countLineDeliverables(activeSelections)} deliverable(s) selected.`
                : null}
            </p>
            <FieldError messages={state.fieldErrors?.name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="start_date">Posting start</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_date">Posting end</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Assignment status</Label>
              <Select
                value={assignmentStatus}
                onValueChange={(v) =>
                  setAssignmentStatus(v as CampaignLineAssignmentStatus)
                }
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="po_amount">PO amount</Label>
              <Input
                id="po_amount"
                name="po_amount"
                type="number"
                min={0}
                step="0.01"
                value={poAmount}
                onChange={(e) => setPoAmount(Number(e.target.value))}
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
                value={revenue}
                onChange={(e) => setRevenue(Number(e.target.value))}
                disabled={isPending || Boolean(line?.revenue_locked)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cost">Creator cost</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                disabled={isPending || Boolean(line?.cost_locked)}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                GP preview: {currency}{" "}
                {(revenue - cost).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending || !canSubmit}>
              {isPending
                ? "Saving…"
                : isEdit
                  ? "Save assignment"
                  : "Create assignment"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
