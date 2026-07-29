"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useConfirmAction } from "@/components/shared/confirm-action-provider";
import { InfluencerTypeahead } from "@/components/forms/influencer-typeahead";
import {
  COMMERCIAL_SYNC_CONFIRMATION_REQUIRED,
  financeLockConfirmationCopy,
} from "@/lib/services/commercial/confirmation-copy";
import { VatAmountSection } from "@/components/forms/vat-amount-section";
import { FieldError } from "@/components/forms/field-error";
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
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
  DetailFormScrollBody,
  DetailFormSection,
  DetailSheetFooter,
  DETAIL_SHEET_SELECT_CONTENT_PROPS,
  OperationalDetailSheet,
  OperationalEditPanelHeader,
} from "@/features/campaigns/components/operational-detail-panel";
import {
  createCampaignLineAction,
  updateCampaignLineAction,
  type FormActionState,
} from "@/features/campaigns/actions";
import { AssignmentIoRevisionDialog } from "@/features/campaigns/components/assignment-io-revision-dialog";
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
  type LineInfluencerAssignment,
} from "@/features/campaigns/line-assignment";
import { AssignmentMultiCurrencyCostFields } from "@/features/campaigns/components/assignment-multi-currency-cost-fields";
import { CampaignLinePoPanel } from "@/features/campaigns/components/campaign-line-po-panel";
import { packagePlatformsToCommercialRows } from "@/lib/assignments/sync-package-deliverables";
import { calculatePoConsumption } from "@/lib/finance/po/calculations";
import { formatMoney } from "@/features/campaigns/utils";
import {
  applyAssignmentCommercialToCommercialRows,
  commercialRowsToPlatformSelections,
  createEmptyCommercialRow,
  rowTotalRevenue,
  summarizeCommercialRows,
  type CommercialDeliverableRow,
} from "@/lib/assignments/commercial-calculations";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { hasActiveFinanceOverride } from "@/lib/campaigns/finance-override";
import {
  computeAgencyFeeAmount,
  computeClientBilling,
} from "@/lib/assignments/client-billing-commercial";

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
  const router = useRouter();
  const { confirm } = useConfirmAction();
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
  const [costReceived, setCostReceived] = useState(
    line?.cost_received ?? line?.cost_before_vat ?? line?.cost ?? 0
  );
  const [costReceivedCurrency, setCostReceivedCurrency] = useState(
    line?.cost_received_currency ?? line?.currency_code ?? currencyCode
  );
  const [revenue, setRevenue] = useState(line?.revenue_before_vat ?? line?.revenue ?? 0);
  const [usageRightsAmount, setUsageRightsAmount] = useState(line?.usage_rights_amount ?? 0);
  const [usageRightsCost, setUsageRightsCost] = useState(line?.usage_rights_cost ?? 0);
  const [agencyFeePercent, setAgencyFeePercent] = useState(line?.agency_fee_percent ?? 0);
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
  const [pricingMode, setPricingMode] = useState<AssignmentPricingMode>(
    line?.assignment?.pricing_mode ?? "package"
  );
  const [commercialRows, setCommercialRows] = useState<CommercialDeliverableRow[]>(
    line?.assignment?.commercial_rows ?? []
  );
  const formRef = useRef<HTMLFormElement>(null);
  const submitLockRef = useRef(false);
  const poExceededOnSaveRef = useRef(false);
  const poExceededAmountRef = useRef(0);
  const [ioRevisionOpen, setIoRevisionOpen] = useState(false);
  const ioRevisionAckRef = useRef(false);
  const [confirmCommercialSync, setConfirmCommercialSync] = useState(false);
  const commercialSyncPromptedRef = useRef(false);

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

  const billingPreview = useMemo(
    () =>
      computeClientBilling({
        revenueBeforeVat: revenue,
        usageRightsAmount,
        usageRightsCost,
        agencyFeePercent,
        vatPercent: revenueVatPercent,
        vatExempt: revenueVatExempt,
        costBeforeVat: cost,
      }),
    [revenue, usageRightsAmount, usageRightsCost, agencyFeePercent, revenueVatPercent, revenueVatExempt, cost]
  );
  const gpPreview = useMemo(
    () => ({ gp: billingPreview.gp, marginPercent: billingPreview.marginPercent }),
    [billingPreview]
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

  const creatorAssignmentForPricing = useMemo((): LineInfluencerAssignment | null => {
    if (line?.assignment) return line.assignment;
    if (!profile || !influencerId) return null;
    return {
      influencer_id: influencerId,
      influencer_name: influencerLabel ?? profile.display_name,
      influencer_document_number: profile.document_number ?? "",
      platforms: profile.platforms.map((p) => ({
        account_id: p.id,
        platform: p.platform,
        handle: p.handle,
        profile_url: p.profile_url,
        follower_count: p.follower_count,
        engagement_rate: p.engagement_rate,
        audience_country: p.audience_country,
        deliverables: [],
      })),
    };
  }, [line?.assignment, profile, influencerId, influencerLabel]);

  const creatorPlatformAccountsForPricing = useMemo(
    () =>
      profile?.platforms ??
      line?.creator_platform_accounts ??
      [],
    [profile?.platforms, line?.creator_platform_accounts]
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
    if (activeSelections.length > 0) {
      return JSON.stringify({
        platforms: activeSelections.map(({ selected: _s, ...rest }) => rest),
      });
    }
    if (line?.assignment?.platforms?.length) {
      return JSON.stringify({ platforms: line.assignment.platforms });
    }
    return JSON.stringify({ platforms: [] });
  }, [pricingMode, commercialRows, profile, activeSelections, line?.assignment?.platforms]);

  const effectiveCommercialRows = useMemo((): CommercialDeliverableRow[] => {
    if (pricingMode !== "per_deliverable") return [];
    if (commercialRows.length > 0) {
      return applyAssignmentCommercialToCommercialRows(
        commercialRows,
        revenue,
        cost,
        usageRightsAmount,
        agencyFeePercent,
        usageRightsCost
      );
    }
    const platforms =
      activeSelections.length > 0
        ? activeSelections.map(({ selected: _s, ...rest }) => rest)
        : (line?.assignment?.platforms ?? []);
    if (platforms.length === 0) return [];
    return applyAssignmentCommercialToCommercialRows(
      packagePlatformsToCommercialRows(platforms, {
        totalRevenueBeforeVat: revenue,
        totalCostBeforeVat: cost,
        dueDate: endDate || null,
      }),
      revenue,
      cost,
      usageRightsAmount,
      agencyFeePercent,
      usageRightsCost
    );
  }, [
    pricingMode,
    commercialRows,
    activeSelections,
    line?.assignment?.platforms,
    revenue,
    cost,
    usageRightsAmount,
    usageRightsCost,
    agencyFeePercent,
    endDate,
  ]);

  const effectiveCommercialSummary = useMemo(
    () => summarizeCommercialRows(effectiveCommercialRows),
    [effectiveCommercialRows]
  );

  const commercialJson = useMemo(
    () => JSON.stringify(effectiveCommercialRows),
    [effectiveCommercialRows]
  );

  const urAfPreview = useMemo(() => {
    if (pricingMode === "per_deliverable" && effectiveCommercialRows.length > 0) {
      const preview = computeClientBilling({
        revenueBeforeVat: effectiveCommercialSummary.total_revenue_before_vat,
        usageRightsAmount,
        agencyFeePercent,
        vatPercent: revenueVatPercent,
        vatExempt: revenueVatExempt,
      });
      return {
        agencyFeeAmount: preview.agencyFeeAmount,
        totalBilling: preview.totalBilling,
      };
    }
    return {
      agencyFeeAmount: billingPreview.agencyFeeAmount,
      totalBilling: billingPreview.totalBilling,
    };
  }, [
    pricingMode,
    effectiveCommercialRows.length,
    effectiveCommercialSummary.total_revenue_before_vat,
    usageRightsAmount,
    agencyFeePercent,
    revenueVatPercent,
    revenueVatExempt,
    billingPreview.agencyFeeAmount,
    billingPreview.totalBilling,
  ]);

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
    if (commercialRows.length === 0) return;
    setRevenue(commercialSummary.total_revenue_before_vat);
    setCost(commercialSummary.total_cost_before_vat);
    setCostReceived(commercialSummary.total_cost_before_vat);
    setCostReceivedCurrency(currency);

    const totalUr = commercialRows.reduce(
      (sum, row) => sum + (row.usage_rights_amount ?? 0),
      0
    );
    setUsageRightsAmount(Math.round(totalUr * 100) / 100);

    const revenueTotal = commercialSummary.total_revenue_before_vat;
    const agencyFeeAmount = commercialRows.reduce((sum, row) => {
      const rowRevenue = rowTotalRevenue(row);
      const ur = Number(row.usage_rights_amount ?? 0);
      return sum + computeAgencyFeeAmount(rowRevenue, ur, row.agency_fee_percent ?? 0);
    }, 0);
    const weightedAfPercent =
      revenueTotal + totalUr > 0
        ? Math.round((agencyFeeAmount / (revenueTotal + totalUr)) * 10000) / 100
        : 0;
    setAgencyFeePercent(weightedAfPercent);
  }, [
    pricingMode,
    commercialRows,
    commercialSummary.total_revenue_before_vat,
    commercialSummary.total_cost_before_vat,
    currency,
  ]);

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
    if (!isPending) {
      submitLockRef.current = false;
    }
  }, [isPending]);

  useEffect(() => {
    if (!open) {
      submitLockRef.current = false;
      poExceededOnSaveRef.current = false;
      poExceededAmountRef.current = 0;
      setIoRevisionOpen(false);
      ioRevisionAckRef.current = false;
      setConfirmCommercialSync(false);
      commercialSyncPromptedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      if (poExceededOnSaveRef.current) {
        toast.warning(
          `PO exceeded by ${formatMoney(poExceededAmountRef.current, currencyCode)}. Assignment saved — adjust revenue or PO to clear.`,
          { duration: 6000 }
        );
      }
      setConfirmCommercialSync(false);
      commercialSyncPromptedRef.current = false;
      router.refresh();
      onOpenChange(false);
      return;
    }

    if (state.code === "FINANCE_LOCKED") {
      submitLockRef.current = false;
      void (async () => {
        const copy = financeLockConfirmationCopy();
        const accepted = await confirm({
          title: state.commercialSync?.confirmationTitle ?? copy.title,
          description:
            state.commercialSync?.confirmationDescription ?? copy.description,
          confirmLabel: copy.confirmLabel,
        });
        if (accepted) {
          toast.message(
            "Commercial Revision workflow will be available in Phase 4."
          );
        }
      })();
      return;
    }

    if (
      state.code === COMMERCIAL_SYNC_CONFIRMATION_REQUIRED &&
      !commercialSyncPromptedRef.current
    ) {
      commercialSyncPromptedRef.current = true;
      submitLockRef.current = false;
      void (async () => {
        const accepted = await confirm({
          title:
            state.commercialSync?.confirmationTitle ?? "Update linked Quotation?",
          description:
            state.commercialSync?.confirmationDescription ??
            "Updating these commercial values will automatically update both the Quotation and the Campaign.",
          confirmLabel: "Continue",
        });
        if (!accepted) {
          commercialSyncPromptedRef.current = false;
          return;
        }
        setConfirmCommercialSync(true);
        queueMicrotask(() => formRef.current?.requestSubmit());
      })();
      return;
    }

    toast.error(state.message);
  }, [state, onOpenChange, router, currencyCode, confirm]);

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
    setCostReceived(line?.cost_received ?? line?.cost_before_vat ?? line?.cost ?? 0);
    setCostReceivedCurrency(
      line?.cost_received_currency ?? line?.currency_code ?? currencyCode
    );
    setRevenue(line?.revenue_before_vat ?? line?.revenue ?? 0);
    setUsageRightsAmount(line?.usage_rights_amount ?? 0);
    setUsageRightsCost(line?.usage_rights_cost ?? 0);
    setAgencyFeePercent(line?.agency_fee_percent ?? 0);
    setRevenueVatPercent(line?.revenue_vat_percent ?? defaultRevenueVatPercent);
    setRevenueVatExempt(line?.revenue_vat_exempt ?? false);
    setCostVatPercent(line?.cost_vat_percent ?? 0);
    setCostVatExempt(line?.cost_vat_exempt ?? true);
    setPoAmount(line?.po_amount ?? 0);
    setStartDate(line?.start_date ?? "");
    setEndDate(line?.end_date ?? "");
    const nextPricingMode = line?.assignment?.pricing_mode ?? "package";
    const storedCommercialRows = line?.assignment?.commercial_rows ?? [];
    const assignmentPlatforms = line?.assignment?.platforms;
    const hydratedCommercialRows =
      nextPricingMode === "per_deliverable" &&
      storedCommercialRows.length === 0 &&
      assignmentPlatforms &&
      assignmentPlatforms.length > 0
        ? packagePlatformsToCommercialRows(assignmentPlatforms, {
            totalRevenueBeforeVat: line?.revenue_before_vat ?? line?.revenue ?? 0,
            totalCostBeforeVat: line?.cost_before_vat ?? line?.cost ?? 0,
            dueDate: line?.end_date ?? null,
          })
        : storedCommercialRows;
    setPricingMode(nextPricingMode);
    setCommercialRows(hydratedCommercialRows);
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

  const financeOverrideActive = hasActiveFinanceOverride(line?.finance_override_until);

  const commercialChanged =
    isEdit && line
      ? Math.abs(revenue - Number(line.revenue_before_vat ?? line.revenue)) > 0.009 ||
        Math.abs(cost - Number(line.cost_before_vat ?? line.cost)) > 0.009
      : false;

  const needsIoRevisionAck =
    isEdit &&
    Boolean(line?.vendor_io_id) &&
    financeOverrideActive &&
    commercialChanged;

  const storedDeliverableUnits = useMemo(() => {
    if (!isEdit || !line) return 0;
    if ((line.deliverable_count ?? 0) > 0) return line.deliverable_count;
    if ((line.assignment?.platforms?.length ?? 0) > 0) {
      return countLineDeliverables(line.assignment!.platforms);
    }
    return line.assignment?.commercial_rows?.reduce((sum, row) => sum + row.quantity, 0) ?? 0;
  }, [isEdit, line]);

  const hasDeliverableScope = isEdit
    ? Boolean(line?.id)
    : pricingMode === "per_deliverable"
      ? commercialRows.length > 0
      : activeSelections.length > 0;

  const canSubmit =
    Boolean(influencerId) &&
    hasDeliverableScope &&
    (!loadingProfile || isEdit) &&
    lineTitle.trim().length > 0;

  const assignmentFieldsLocked =
    Boolean(line?.vendor_assignment_locked) && !financeOverrideActive;

  const commercialFieldsLocked = (locked: boolean) =>
    isPending || (!financeOverrideActive && locked);

  const costCommercialLocked =
    isEdit && commercialFieldsLocked(Boolean(line?.cost_locked || line?.vat_locked));

  const costLockHint = costCommercialLocked
    ? line?.cost_locked
      ? "Cost and cost currency are locked because this assignment has been invoiced. Request a finance override from Billing to edit."
      : "Cost fields are locked while VAT is finalized on this assignment."
    : null;

  const revenueVatAmount = billingPreview.vatAmount;
  const costVatAmount = costVatExempt
    ? 0
    : Math.round(cost * costVatPercent) / 100;

  const footerSummary = useMemo(() => {
    const deliverableUnits =
      activeSelections.length > 0
        ? countLineDeliverables(activeSelections)
        : storedDeliverableUnits;

    if (pricingMode === "per_deliverable" && effectiveCommercialRows.length > 0) {
      return effectiveCommercialSummary;
    }

    return {
      total_cost_before_vat: cost,
      total_revenue_before_vat: revenue,
      gp: gpPreview.gp,
      margin_percent: gpPreview.marginPercent,
      deliverable_units: deliverableUnits,
    };
  }, [
    pricingMode,
    effectiveCommercialRows.length,
    effectiveCommercialSummary,
    cost,
    revenue,
    gpPreview.gp,
    gpPreview.marginPercent,
    activeSelections,
    storedDeliverableUnits,
  ]);

  const sheetTitle = isEdit ? "Edit influencer assignment" : "Assign influencer";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={sheetTitle}
      description="Influencer assignment commercial planning"
    >
      <form
        ref={formRef}
        action={formAction}
        data-shortcut-save
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
            if (submitLockRef.current || isPending) {
              event.preventDefault();
              return;
            }

            if (needsIoRevisionAck && !ioRevisionAckRef.current) {
              event.preventDefault();
              setIoRevisionOpen(true);
              return;
            }

            poExceededOnSaveRef.current = poSnapshot.is_over_consumed;
            poExceededAmountRef.current = poSnapshot.exceeded_amount;
            submitLockRef.current = true;
            ioRevisionAckRef.current = false;
          }}
      >
        <OperationalEditPanelHeader
          title={sheetTitle}
          description="Select a creator, choose platform accounts and deliverables, then set commercial terms. Line title is generated automatically."
        />

        <DetailFormScrollBody>
          <input type="hidden" name="campaign_id" value={campaignId} />
          {isEdit ? <input type="hidden" name="line_id" value={line.id} /> : null}
          {confirmCommercialSync ? (
            <input type="hidden" name="confirm_commercial_sync" value="1" />
          ) : null}
          {confirmCommercialSync ? (
            <input
              type="hidden"
              name="commercial_sync_idempotency_key"
              value={`campaign-line:${line?.id ?? "new"}:${campaignId}`}
            />
          ) : null}
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
            disabled={isPending || assignmentFieldsLocked}
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

          <DetailFormSection
            label="Pricing structure"
            hint="Alt+M to switch mode · Package = single creator cost · Per deliverable = row-level commercial planning"
          >
            <Select
              modal={false}
              value={pricingMode}
              onValueChange={(v) => {
                const next = v as AssignmentPricingMode;
                if (
                  next === "per_deliverable" &&
                  pricingMode === "package" &&
                  commercialRows.length === 0 &&
                  activeSelections.length > 0
                ) {
                  const converted = packagePlatformsToCommercialRows(
                    activeSelections.map(({ selected: _s, ...rest }) => rest),
                    {
                      totalRevenueBeforeVat: revenue,
                      totalCostBeforeVat: cost,
                      dueDate: endDate || null,
                    }
                  );
                  if (converted.length > 0) {
                    setCommercialRows(
                      applyAssignmentCommercialToCommercialRows(
                        converted,
                        revenue,
                        cost,
                        usageRightsAmount,
                        agencyFeePercent,
                        usageRightsCost
                      )
                    );
                  }
                }
                setPricingMode(next);
              }}
              disabled={isPending}
            >
              <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent {...DETAIL_SHEET_SELECT_CONTENT_PROPS}>
                <SelectItem value="package">Package pricing</SelectItem>
                <SelectItem value="per_deliverable">Per deliverable pricing</SelectItem>
              </SelectContent>
            </Select>
          </DetailFormSection>

          {loadingProfile ? (
            <p className="text-sm text-muted-foreground">Loading creator profile…</p>
          ) : profile && pricingMode === "package" ? (
            <PlatformAccountSelector
              profile={profile}
              selections={selections}
              onChange={setSelections}
              disabled={isPending || assignmentFieldsLocked}
            />
          ) : profile && pricingMode === "per_deliverable" ? (
            <DeliverablePricingEditor
              rows={commercialRows}
              onChange={setCommercialRows}
              currency={currency}
              disabled={isPending || assignmentFieldsLocked}
              assignment={creatorAssignmentForPricing}
              creatorPlatformAccounts={creatorPlatformAccountsForPricing}
            />
          ) : null}

          <DetailFormSection
            label="Assignment title"
            hint={`Auto-generated — edit if needed.${
              activeSelections.length > 0
                ? ` ${countLineDeliverables(activeSelections)} deliverable(s) selected.`
                : ""
            }`}
          >
            <Input
              id="line_title"
              className={DETAIL_FORM_INPUT_CLASS}
              value={lineTitle}
              onChange={(e) => {
                setLineTitle(e.target.value);
                setTitleEdited(true);
              }}
              placeholder={autoTitle || "Auto-generated from creator + platforms"}
              disabled={isPending}
              required
            />
            <FieldError messages={state.fieldErrors?.name} />
          </DetailFormSection>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailFormSection label="Posting start">
              <Input
                id="start_date"
                type="date"
                className={DETAIL_FORM_INPUT_CLASS}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending}
              />
            </DetailFormSection>
            <DetailFormSection label="Posting end">
              <Input
                id="end_date"
                type="date"
                className={DETAIL_FORM_INPUT_CLASS}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isPending}
              />
            </DetailFormSection>
            <DetailFormSection label="Assignment status">
              <Select
                modal={false}
                value={assignmentStatus}
                onValueChange={(v) =>
                  setAssignmentStatus(v as CampaignLineAssignmentStatus)
                }
                disabled={isPending}
              >
                <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...DETAIL_SHEET_SELECT_CONTENT_PROPS}>
                  {ASSIGNMENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailFormSection>
            <DetailFormSection label="Currency">
              <Select
                modal={false}
                value={currency}
                onValueChange={setCurrency}
                disabled={isPending}
              >
                <SelectTrigger className={DETAIL_FORM_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...DETAIL_SHEET_SELECT_CONTENT_PROPS}>
                  {currencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailFormSection>
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
              vatDisplayBase={billingPreview.taxableBase}
              vatDisplayBaseHint="VAT base (Rev + UR Rev + Fees)"
              vatPercent={revenueVatPercent}
              exempt={revenueVatExempt}
              currency={currency}
              disabled={commercialFieldsLocked(
                Boolean(line?.revenue_locked || line?.vat_locked)
              )}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  UR Rev
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={usageRightsAmount}
                  onChange={(event) =>
                    setUsageRightsAmount(Number(event.target.value) || 0)
                  }
                  disabled={commercialFieldsLocked(
                    Boolean(line?.revenue_locked || line?.vat_locked)
                  )}
                  className={DETAIL_FORM_INPUT_CLASS}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Agency fee (AF %)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={agencyFeePercent}
                  onChange={(event) =>
                    setAgencyFeePercent(Number(event.target.value) || 0)
                  }
                  disabled={commercialFieldsLocked(
                    Boolean(line?.revenue_locked || line?.vat_locked)
                  )}
                  className={DETAIL_FORM_INPUT_CLASS}
                />
                <p className="text-[11px] text-muted-foreground">
                  {pricingMode === "per_deliverable"
                    ? "Distributes to deliverable rows on save · "
                    : ""}
                  AF amount: {currency}{" "}
                  {urAfPreview.agencyFeeAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  · Total billing: {currency}{" "}
                  {urAfPreview.totalBilling.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  UR Cost
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={usageRightsCost}
                  onChange={(event) =>
                    setUsageRightsCost(Number(event.target.value) || 0)
                  }
                  disabled={commercialFieldsLocked(
                    Boolean(line?.cost_locked || line?.vat_locked)
                  )}
                  className={DETAIL_FORM_INPUT_CLASS}
                />
                <p className="text-[11px] text-muted-foreground">
                  Creator usage rights cost — deducted from GP, not client billing.
                </p>
              </div>
            </div>

            <AssignmentMultiCurrencyCostFields
              campaignCurrency={currency}
              costReceived={costReceived}
              costReceivedCurrency={costReceivedCurrency}
              costInLc={cost}
              currencyOptions={currencyOptions}
              disabled={costCommercialLocked}
              lockHint={costLockHint}
              onCostReceivedChange={setCostReceived}
              onCostReceivedCurrencyChange={setCostReceivedCurrency}
              onCostInLcChange={setCost}
              onFxRateChange={() => {}}
            />

            <VatAmountSection
              title="Creator cost VAT"
              amountLabel="Cost in LC (ex-VAT)"
              beforeVat={cost}
              vatPercent={costVatPercent}
              exempt={costVatExempt}
              currency={currency}
              disabled={commercialFieldsLocked(
                Boolean(line?.cost_locked || line?.vat_locked)
              )}
              amountDisabled
              onBeforeVatChange={() => {}}
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
            <input type="hidden" name="usage_rights_amount" value={usageRightsAmount} />
            <input type="hidden" name="usage_rights_cost" value={usageRightsCost} />
            <input type="hidden" name="agency_fee_percent" value={agencyFeePercent} />
            <input type="hidden" name="cost_before_vat" value={cost} />
            <input type="hidden" name="revenue_vat_percent" value={revenueVatPercent} />
            <input type="hidden" name="cost_vat_percent" value={costVatPercent} />
            <input
              type="hidden"
              name="revenue_vat_exempt"
              value={revenueVatExempt ? "1" : "0"}
            />
            <input type="hidden" name="cost_vat_exempt" value={costVatExempt ? "1" : "0"} />

            <p className="text-[11px] text-muted-foreground">
              Operational GP (Rev + UR Rev + AF − cost − UR Cost): {currency}{" "}
              {gpPreview.gp.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              · Margin {gpPreview.marginPercent}%
            </p>
          </div>
        </DetailFormScrollBody>

        <AssignmentStickyFooter
          currency={currency}
          summary={footerSummary}
          revenueVatAmount={revenueVatAmount}
          costVatAmount={costVatAmount}
        />

        <DetailSheetFooter>
          <Button size="sm" type="submit" disabled={isPending || !canSubmit}>
            {isPending
              ? "Saving…"
              : isEdit
                ? "Save assignment"
                : "Create assignment"}
          </Button>
        </DetailSheetFooter>
      </form>

      <AssignmentIoRevisionDialog
        open={ioRevisionOpen}
        onOpenChange={setIoRevisionOpen}
        vendorIoDocumentNumber={line?.vendor_io_document_number ?? null}
        onCancel={() => setIoRevisionOpen(false)}
        onConfirm={() => {
          ioRevisionAckRef.current = true;
          setIoRevisionOpen(false);
          queueMicrotask(() => formRef.current?.requestSubmit());
        }}
      />
    </OperationalDetailSheet>
  );
}
