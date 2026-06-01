"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { InfluencerTypeahead } from "@/components/forms/influencer-typeahead";
import { VatAmountSection } from "@/components/forms/vat-amount-section";
import { FieldError } from "@/components/forms/field-error";
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
import { AssignmentStickyFooter } from "@/features/campaigns/components/assignment-sticky-footer";
import { DeliverablePricingEditor } from "@/features/campaigns/components/deliverable-pricing-editor";
import {
  buildInitialSelections,
  PlatformAccountSelector,
  type PlatformSelectionState,
} from "@/features/campaigns/components/platform-account-selector";
import {
  ASSIGNMENT_STATUS_OPTIONS,
} from "@/features/campaigns/constants";
import {
  buildLineTitle,
  countLineDeliverables,
  suggestCostFromRateCard,
  type AssignmentPricingMode,
} from "@/features/campaigns/line-assignment";
import { CampaignLinePoPanel } from "@/features/campaigns/components/campaign-line-po-panel";
import { PoGovernanceDialog } from "@/features/campaigns/components/po-governance-dialog";
import { calculatePoConsumption } from "@/lib/finance/po/calculations";
import {
  commercialRowsToPlatformSelections,
  createEmptyCommercialRow,
  summarizeCommercialRows,
  type CommercialDeliverableRow,
} from "@/lib/assignments/commercial-calculations";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { computeOperationalGp } from "@/lib/vat/calculations";

import type {
  CampaignLineAssignmentStatus,
  CampaignLineWorkspace,
  CampaignPoSummary,
  InfluencerAssignmentProfile,
  InfluencerSearchResult,
} from "@/features/campaigns/types";

type CampaignLineSheetProps = {
  campaignId: string;
  currencyCode: string;
  defaultRevenueVatPercent: number;
  clientCountryCode: string | null;
  po: CampaignPoSummary;
  currencyOptions: { value: string; label: string }[];
  line: CampaignLineWorkspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignLineSheet({
  campaignId,
  currencyCode,
  defaultRevenueVatPercent,
  clientCountryCode,
  po,
  currencyOptions,
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
  const [cost, setCost] = useState(line?.cost_before_vat ?? line?.cost ?? 0);
  const [revenue, setRevenue] = useState(line?.revenue_before_vat ?? line?.revenue ?? 0);
  const [revenueVatPercent, setRevenueVatPercent] = useState(
    line?.revenue_vat_percent ?? defaultRevenueVatPercent
  );
  const [revenueVatExempt, setRevenueVatExempt] = useState(
    line?.revenue_vat_exempt ?? false
  );
  const [costVatPercent, setCostVatPercent] = useState(line?.cost_vat_percent ?? 0);
  const [costVatExempt, setCostVatExempt] = useState(line?.cost_vat_exempt ?? true);
  const [poAmount, setPoAmount] = useState(line?.po_amount ?? 0);
  const [startDate, setStartDate] = useState(line?.start_date ?? "");
  const [endDate, setEndDate] = useState(line?.end_date ?? "");
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [overrideApproved, setOverrideApproved] = useState(false);
  const [pricingMode, setPricingMode] = useState<AssignmentPricingMode>(
    line?.assignment?.pricing_mode ?? "package"
  );
  const [commercialRows, setCommercialRows] = useState<CommercialDeliverableRow[]>(
    line?.assignment?.commercial_rows ?? []
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submitLockRef = useRef(false);
  const overrideApprovedRef = useRef(false);

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

  const gpPreview = useMemo(
    () => computeOperationalGp(revenue, cost),
    [revenue, cost]
  );

  const activeSelections = useMemo(
    () =>
      selections.filter((s) => s.selected && s.deliverables.length > 0),
    [selections]
  );

  const commercialSummary = useMemo(
    () => summarizeCommercialRows(commercialRows),
    [commercialRows]
  );

  const assignmentJson = useMemo(() => {
    if (pricingMode === "per_deliverable" && commercialRows.length > 0 && profile) {
      const accountLookup = new Map(
        profile.platforms.map((p) => [
          p.platform,
          {
            account_id: p.id,
            handle: p.handle,
            profile_url: p.profile_url,
            follower_count: p.follower_count,
            engagement_rate: p.engagement_rate,
            audience_country: p.audience_country,
          },
        ])
      );
      const platforms = commercialRowsToPlatformSelections(commercialRows, accountLookup);
      return JSON.stringify({ platforms });
    }
    return JSON.stringify({
      platforms: activeSelections.map(({ selected: _s, ...rest }) => rest),
    });
  }, [pricingMode, commercialRows, profile, activeSelections]);

  const commercialJson = useMemo(
    () => JSON.stringify(commercialRows),
    [commercialRows]
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
    if (pricingMode !== "per_deliverable") return;
    setRevenue(commercialSummary.total_revenue_before_vat);
    setCost(commercialSummary.total_cost_before_vat);
  }, [pricingMode, commercialSummary.total_revenue_before_vat, commercialSummary.total_cost_before_vat]);

  useRegisterShortcut(
    open
      ? {
          id: "assignment-add-row",
          keys: "alt+n",
          label: "Add deliverable row",
          group: "Assignment",
          handler: () =>
            setCommercialRows((rows) => [...rows, createEmptyCommercialRow()]),
        }
      : null
  );

  useRegisterShortcut(
    open
      ? {
          id: "assignment-pricing-mode",
          keys: "alt+m",
          label: "Switch pricing mode",
          group: "Assignment",
          handler: () =>
            setPricingMode((m) => (m === "package" ? "per_deliverable" : "package")),
        }
      : null
  );

  useRegisterShortcut(
    open
      ? {
          id: "assignment-toggle-vat",
          keys: "alt+v",
          label: "Toggle revenue VAT exempt",
          group: "Assignment",
          handler: () => setRevenueVatExempt((v) => !v),
        }
      : null
  );

  useRegisterShortcut(
    open
      ? {
          id: "assignment-submit",
          keys: "ctrl+enter",
          label: "Save assignment",
          group: "Assignment",
          handler: () => formRef.current?.requestSubmit(),
        }
      : null
  );

  useEffect(() => {
    overrideApprovedRef.current = overrideApproved;
  }, [overrideApproved]);

  useEffect(() => {
    if (!isPending) {
      submitLockRef.current = false;
    }
  }, [isPending]);

  useEffect(() => {
    if (!open) {
      submitLockRef.current = false;
      setOverrideApproved(false);
      overrideApprovedRef.current = false;
    }
  }, [open]);

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
      if (data.profile.vat_registered) {
        setCostVatPercent(data.profile.suggested_cost_vat_percent);
        setCostVatExempt(false);
      } else {
        setCostVatPercent(0);
        setCostVatExempt(true);
      }
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
    setCost(line?.cost_before_vat ?? line?.cost ?? 0);
    setRevenue(line?.revenue_before_vat ?? line?.revenue ?? 0);
    setRevenueVatPercent(line?.revenue_vat_percent ?? defaultRevenueVatPercent);
    setRevenueVatExempt(line?.revenue_vat_exempt ?? false);
    setCostVatPercent(line?.cost_vat_percent ?? 0);
    setCostVatExempt(line?.cost_vat_exempt ?? true);
    setPoAmount(line?.po_amount ?? 0);
    setStartDate(line?.start_date ?? "");
    setEndDate(line?.end_date ?? "");
    setPricingMode(line?.assignment?.pricing_mode ?? "package");
    setCommercialRows(line?.assignment?.commercial_rows ?? []);
    setProfile(null);
    setSelections([]);

    if (line?.influencer_id) {
      const existing = line.assignment?.platforms.map((p) => ({
        ...p,
        selected: true,
      }));
      void loadProfile(line.influencer_id, existing);
    }
  }, [open, line, currencyCode, defaultRevenueVatPercent]);

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

  const poSnapshot = useMemo(
    () =>
      calculatePoConsumption({
        po_amount: po.po_amount_campaign_currency,
        consumed: po.po_consumed_amount,
        current_line_revenue: revenue,
        exclude_line_revenue: line?.revenue_before_vat ?? 0,
      }),
    [po, revenue, line?.revenue_before_vat]
  );

  const canSubmit =
    Boolean(influencerId) &&
    (pricingMode === "per_deliverable"
      ? commercialRows.length > 0
      : activeSelections.length > 0) &&
    !loadingProfile &&
    lineTitle.trim().length > 0;

  const revenueVatAmount = revenueVatExempt
    ? 0
    : Math.round(revenue * revenueVatPercent) / 100;
  const costVatAmount = costVatExempt
    ? 0
    : Math.round(cost * costVatPercent) / 100;

  const footerSummary = useMemo(() => {
    if (pricingMode === "per_deliverable") {
      return commercialSummary;
    }
    return {
      total_cost_before_vat: cost,
      total_revenue_before_vat: revenue,
      gp: gpPreview.gp,
      margin_percent: gpPreview.marginPercent,
      deliverable_units: countLineDeliverables(activeSelections),
    };
  }, [pricingMode, commercialSummary, cost, revenue, gpPreview, activeSelections]);

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
        <form
          ref={formRef}
          action={formAction}
          data-shortcut-save
          className="flex flex-1 flex-col gap-5 px-6 pb-24"
          onSubmit={(event) => {
            if (submitLockRef.current || isPending) {
              event.preventDefault();
              return;
            }

            if (
              poSnapshot.is_over_consumed &&
              !overrideApprovedRef.current &&
              !po.po_override_approved
            ) {
              event.preventDefault();
              setPoDialogOpen(true);
              return;
            }

            submitLockRef.current = true;
          }}
        >
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
          <input type="hidden" name="pricing_mode" value={pricingMode} />
          <input type="hidden" name="commercial_json" value={commercialJson} />

          <InfluencerTypeahead
            value={influencerId}
            selectedLabel={influencerLabel}
            onSelect={onInfluencerPick}
            disabled={isPending || Boolean(line?.vendor_assignment_locked)}
          />
          <FieldError messages={state.fieldErrors?.influencer_id} />

          {profile ? (
            <div className="rounded-2xl border bg-muted/20 p-3 text-sm">
              <p className="font-medium">{profile.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {profile.country_code ?? "—"}
                {profile.vat_registered ? " · VAT registered" : " · Non-VAT creator"}
                {profile.notes ? ` · ${profile.notes}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.platforms.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-[10px]">
                    {p.platform} · {p.follower_count?.toLocaleString() ?? "—"} followers
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Pricing structure</Label>
            <Select
              value={pricingMode}
              onValueChange={(v) => setPricingMode(v as AssignmentPricingMode)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="package">Package pricing</SelectItem>
                <SelectItem value="per_deliverable">Per deliverable pricing</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Alt+M to switch mode · Package = single creator cost · Per deliverable = row-level commercial planning
            </p>
          </div>

          {loadingProfile ? (
            <p className="text-sm text-muted-foreground">Loading creator profile…</p>
          ) : profile && pricingMode === "package" ? (
            <PlatformAccountSelector
              profile={profile}
              selections={selections}
              onChange={setSelections}
              disabled={isPending || Boolean(line?.vendor_assignment_locked)}
            />
          ) : profile && pricingMode === "per_deliverable" ? (
            <DeliverablePricingEditor
              rows={commercialRows}
              onChange={setCommercialRows}
              currency={currency}
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
                  {currencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CampaignLinePoPanel
            currency={currencyCode}
            poAmount={po.po_amount_campaign_currency}
            consumed={po.po_consumed_amount}
            currentLineRevenue={revenue}
            excludeLineRevenue={line?.revenue_before_vat ?? 0}
            poCurrency={po.po_currency}
            exchangeRate={po.po_exchange_rate}
            fxSnapshotAt={po.fx_snapshot_at}
          />

          <div className="grid gap-4">
            <input type="hidden" name="po_amount" value={poAmount} />
            <VatAmountSection
              title="Client revenue"
              amountLabel="Revenue (ex-VAT)"
              beforeVat={revenue}
              vatPercent={revenueVatPercent}
              exempt={revenueVatExempt}
              currency={currency}
              disabled={isPending || Boolean(line?.revenue_locked || line?.vat_locked)}
              onBeforeVatChange={setRevenue}
              onVatPercentChange={setRevenueVatPercent}
              onExemptChange={setRevenueVatExempt}
              badge={
                revenueVatExempt ? (
                  <Badge variant="outline">VAT Exempt</Badge>
                ) : clientCountryCode ? (
                  <Badge variant="secondary">
                    Billing entity · {clientCountryCode} · default {defaultRevenueVatPercent}%
                  </Badge>
                ) : null
              }
            />

            <VatAmountSection
              title="Creator cost"
              amountLabel="Cost (ex-VAT)"
              beforeVat={cost}
              vatPercent={costVatPercent}
              exempt={costVatExempt}
              currency={currency}
              disabled={isPending || Boolean(line?.cost_locked || line?.vat_locked)}
              onBeforeVatChange={setCost}
              onVatPercentChange={setCostVatPercent}
              onExemptChange={setCostVatExempt}
              badge={
                profile?.vat_registered ? (
                  <Badge variant="secondary">VAT Registered</Badge>
                ) : (
                  <Badge variant="outline">Non-VAT creator</Badge>
                )
              }
            />

            <input type="hidden" name="revenue" value={revenue} />
            <input type="hidden" name="cost" value={cost} />
            <input type="hidden" name="revenue_before_vat" value={revenue} />
            <input type="hidden" name="cost_before_vat" value={cost} />
            <input type="hidden" name="revenue_vat_percent" value={revenueVatPercent} />
            <input type="hidden" name="cost_vat_percent" value={costVatPercent} />
            <input
              type="hidden"
              name="revenue_vat_exempt"
              value={revenueVatExempt ? "1" : "0"}
            />
            <input type="hidden" name="cost_vat_exempt" value={costVatExempt ? "1" : "0"} />

            <p className="text-xs text-muted-foreground">
              Operational GP (ex-VAT): {currency}{" "}
              {gpPreview.gp.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              · Margin {gpPreview.marginPercent}%
            </p>
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

          <AssignmentStickyFooter
            currency={currency}
            summary={footerSummary}
            revenueVatAmount={revenueVatAmount}
            costVatAmount={costVatAmount}
            poExceeded={poSnapshot.is_over_consumed}
          />
        </form>
        <PoGovernanceDialog
          open={poDialogOpen}
          onOpenChange={setPoDialogOpen}
          campaignId={campaignId}
          lineId={line?.id}
          currency={currencyCode}
          snapshot={poSnapshot}
          onCancel={() => setPoDialogOpen(false)}
          onConfirm={() => {
            if (submitLockRef.current || isPending) return;
            overrideApprovedRef.current = true;
            setOverrideApproved(true);
            setPoDialogOpen(false);
            submitLockRef.current = true;
            formRef.current?.requestSubmit();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
