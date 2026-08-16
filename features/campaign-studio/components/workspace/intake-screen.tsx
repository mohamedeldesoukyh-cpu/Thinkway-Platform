"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2Icon, Loader2Icon, ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  CampaignIntelligencePanel,
} from "@/features/campaign-intelligence-profile/components/campaign-intelligence-panel";
import {
  getConversationCampaignIntelligenceAction,
  type CampaignIntelligenceWorkspaceState,
} from "@/features/campaign-intelligence-profile/actions/profile-actions";
import {
  isCampaignIntelligenceConfirmed,
} from "@/features/campaign-intelligence-profile/services/campaign-facts-spine";
import { profileToCampaignFacts } from "@/features/campaign-intelligence-profile/services/profile-to-facts";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import {
  confirmStudioIntakeAction,
} from "../../actions/confirm-studio-intake-action";
import {
  campaignFactsFromIntakeEdit,
  formatDurationWeeks,
  mergeIntakeDisplayFacts,
  requiredIntakeFacts,
  type IntakeFactsEdit,
} from "../../services/studio-intake-facts";
import { isStudioIntakeConfirmed } from "../../services/studio-workspace-status";
import type { StudioWorkspaceStepId } from "../../constants/studio-workspace";
import { STUDIO_WORKSPACE_STEPS } from "../../constants/studio-workspace";
import {
  INTAKE_COUNTRY_OPTIONS,
  INTAKE_DELIVERABLE_OPTIONS,
  INTAKE_KPI_OPTIONS,
  INTAKE_PLATFORM_OPTIONS,
} from "../../constants/intake-field-options";
import { CampaignBriefCard } from "../sections/campaign-brief-card";
import { IntakeOptionChips } from "./intake-option-chips";

type IntakeScreenProps = {
  campaignObject?: CampaignObject;
  conversationId?: string;
  messageId?: string;
  onCampaignObjectUpdated?: (campaignObject: Record<string, unknown>) => void;
  onNavigateStep?: (stepId: StudioWorkspaceStepId) => void;
  workflowStatus?: string;
  workflowProgressPercent?: number;
};

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function countrySelectValue(raw: string): string {
  const parts = splitList(raw);
  for (const part of parts) {
    const match = INTAKE_COUNTRY_OPTIONS.find(
      (option) => option.value.toLowerCase() === part.toLowerCase()
    );
    if (match) return match.value;
  }
  return parts[0] ?? "";
}

export function IntakeScreen({
  campaignObject,
  conversationId,
  messageId,
  onCampaignObjectUpdated,
  onNavigateStep,
  workflowStatus,
  workflowProgressPercent,
}: IntakeScreenProps) {
  const facts = getCampaignFacts(campaignObject);
  const confirmed = isStudioIntakeConfirmed(campaignObject);
  const [pending, startTransition] = useTransition();
  const [cipState, setCipState] = useState<CampaignIntelligenceWorkspaceState | null>(null);
  const [draft, setDraft] = useState({
    client: "",
    campaign: "",
    brand: "",
    country: "",
    budget: "",
    currency: "EGP",
    durationWeeks: "",
    objective: "",
    audience: "",
    category: "",
    platforms: "",
    deliverables: "",
    kpis: "",
  });
  const displayFacts = useMemo(
    () =>
      mergeIntakeDisplayFacts(
        facts,
        cipState?.profile ? profileToCampaignFacts(cipState.profile) : undefined
      ),
    [facts, cipState]
  );
  const intake = useMemo(() => {
    const amount = Number(draft.budget.replace(/,/g, ""));
    const weeks = Number(draft.durationWeeks);
    const fromDraft = campaignFactsFromIntakeEdit(
      {
        clientName: draft.client,
        brandName: draft.brand,
        product: draft.campaign,
        industry: draft.category,
        objective: draft.objective,
        audience: draft.audience,
        geography: splitList(draft.country),
        platforms: splitList(draft.platforms),
        deliverables: splitList(draft.deliverables),
        kpis: splitList(draft.kpis),
        budgetAmount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        budgetCurrency: draft.currency,
        durationWeeks: Number.isFinite(weeks) && weeks > 0 ? weeks : undefined,
      },
      displayFacts
    );
    return requiredIntakeFacts(mergeIntakeDisplayFacts(displayFacts, fromDraft));
  }, [displayFacts, draft]);

  useEffect(() => {
    setDraft({
      client: displayFacts?.clientName ?? "",
      campaign: displayFacts?.product ?? "",
      brand: displayFacts?.brandName ?? "",
      country: (displayFacts?.geography ?? []).join(", "),
      budget: displayFacts?.budget?.amount?.toString() ?? "",
      currency: displayFacts?.budget?.currency ?? "EGP",
      durationWeeks: displayFacts?.durationWeeks?.toString() ?? "",
      objective: displayFacts?.objective ?? "",
      audience: displayFacts?.audience ?? "",
      category: displayFacts?.industry ?? "",
      platforms: (displayFacts?.platforms ?? []).join(", "),
      deliverables: (displayFacts?.deliverables ?? []).join(", "),
      kpis: (displayFacts?.kpis ?? []).join(", "),
    });
  }, [displayFacts]);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let attempts = 0;

    async function loadCip() {
      const row = await getConversationCampaignIntelligenceAction(conversationId!);
      if (cancelled || !row) return false;
      setCipState({
        profileId: row.id,
        profile: row.profile,
        fileName: row.title ?? null,
        fileSizeBytes: null,
        hasExtractedData: true,
        parsedTextLength: row.profile.rawBriefExcerpt?.length ?? 0,
      });
      return true;
    }

    void loadCip();
    const timer = window.setInterval(() => {
      attempts += 1;
      void loadCip().then((found) => {
        if (found || attempts >= 20) window.clearInterval(timer);
      });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [conversationId]);

  const creatorsData = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  const profileId = cipState?.profileId ?? creatorsData.cipProfileId;
  const workflowBusy =
    workflowStatus === "running" || campaignObject?.meta.status === "building";
  const awaitingFacts = !displayFacts?.brandName && !displayFacts?.clientName && !displayFacts?.product;
  const isExtracting = workflowBusy && awaitingFacts;

  function editFromDraft(): IntakeFactsEdit {
    const amount = Number(draft.budget.replace(/,/g, ""));
    const weeks = Number(draft.durationWeeks);
    return {
      clientName: draft.client,
      brandName: draft.brand,
      product: draft.campaign,
      industry: draft.category,
      objective: draft.objective,
      audience: draft.audience,
      geography: splitList(draft.country),
      platforms: splitList(draft.platforms),
      deliverables: splitList(draft.deliverables),
      kpis: splitList(draft.kpis),
      budgetAmount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      budgetCurrency: draft.currency,
      durationWeeks: Number.isFinite(weeks) && weeks > 0 ? weeks : undefined,
    };
  }

  function confirmCampaign() {
    if (!conversationId) {
      toast.error("Open this campaign in Studio to confirm facts.");
      return;
    }
    startTransition(async () => {
      const result = await confirmStudioIntakeAction({
        conversationId,
        profileId,
        edit: editFromDraft(),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onCampaignObjectUpdated?.(result.campaignObject);
      toast.success(result.message);
      onNavigateStep?.("strategy");
    });
  }

  return (
    <div className="min-w-0 space-y-5">
      {workflowBusy ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#0057FF]/25 bg-[#0057FF]/5 px-4 py-3">
          <Loader2Icon className="mt-0.5 size-5 shrink-0 animate-spin text-[#0057FF]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-foreground">
              {awaitingFacts ? "Reading your brief" : "Studio is still working"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {awaitingFacts
                ? "Extracting campaign facts. Missing values stay missing — they are never invented."
                : "Strategy and creator matches continue in the background. Review and confirm facts below."}
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0057FF]/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={workflowProgressPercent ?? 0}
              aria-label="Studio progress"
            >
              <div
                className="h-full rounded-full bg-[#0057FF] transition-[width]"
                style={{
                  width: `${Math.max(8, Math.min(100, workflowProgressPercent ?? 8))}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <CampaignBriefCard
        campaignObject={campaignObject}
        conversationId={conversationId}
        messageId={messageId}
        onBriefApplied={onCampaignObjectUpdated}
      />

      {conversationId ? (
        <CampaignIntelligencePanel
          variant="inline"
          actions="none"
          initialState={cipState}
          conversationId={conversationId}
          isAnalyzing={isExtracting && !cipState?.profileId}
          onWorkspaceChange={setCipState}
        />
      ) : null}

      <section className="rounded-2xl border border-[#0057FF]/20 bg-[#0057FF]/5 p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#0057FF]">
          What happens next
        </p>
        <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
          {STUDIO_WORKSPACE_STEPS.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className={item.id === "intake" ? "text-[#0057FF]" : "text-muted-foreground"}>
                {index + 1}. {item.label}
              </span>
              {index < STUDIO_WORKSPACE_STEPS.length - 1 ? (
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm text-muted-foreground">
          Confirm the facts on this screen, then Strategy. After that: Creators, Content, Commercial,
          and Package.
        </p>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold tracking-tight">What Thinkway understood</h3>
            <p className="text-xs text-muted-foreground">
              Edit any fact. Missing values stay missing — they are never invented.
            </p>
          </div>
          {confirmed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0C9D57]/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#0C9D57]">
              <CheckCircle2Icon className="size-3" />
              Confirmed
            </span>
          ) : null}
        </div>
        <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {intake.rows.map((row) => (
            <div key={row.key} className="min-w-0 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
              <dt className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                {row.label}
                <span className={row.state === "missing" ? "text-amber-700" : "text-[#0C9D57]"}>
                  {row.state === "missing" ? "Missing" : "Confirmed"}
                </span>
              </dt>
              <dd className="mt-1">
                {row.key === "budget" ? (
                  <div className="flex gap-2">
                    <Input
                      className="h-8 text-sm"
                      value={draft.currency}
                      onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value }))}
                      aria-label="Currency"
                    />
                    <Input
                      className="h-8 text-sm"
                      value={draft.budget}
                      onChange={(event) => setDraft((prev) => ({ ...prev, budget: event.target.value }))}
                      aria-label="Budget"
                    />
                  </div>
                ) : row.key === "duration" ? (
                  <div>
                    <Input
                      className="h-8 text-sm"
                      value={draft.durationWeeks}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, durationWeeks: event.target.value }))
                      }
                      aria-label="Duration in weeks"
                      placeholder="Weeks — do not invent"
                    />
                    {formatDurationWeeks(Number(draft.durationWeeks)) ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDurationWeeks(Number(draft.durationWeeks))}
                      </p>
                    ) : null}
                  </div>
                ) : row.key === "country" ? (
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={countrySelectValue(draft.country)}
                    onChange={(event) => {
                      setDraft((prev) => ({ ...prev, country: event.target.value }));
                    }}
                    aria-label="Country"
                  >
                    <option value="">Select country</option>
                    {countrySelectValue(draft.country) &&
                    !INTAKE_COUNTRY_OPTIONS.some(
                      (option) => option.value === countrySelectValue(draft.country)
                    ) ? (
                      <option value={countrySelectValue(draft.country)}>
                        {countrySelectValue(draft.country)}
                      </option>
                    ) : null}
                    {INTAKE_COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : row.key === "platforms" ? (
                  <IntakeOptionChips
                    options={INTAKE_PLATFORM_OPTIONS}
                    selected={splitList(draft.platforms)}
                    onChange={(next) => setDraft((prev) => ({ ...prev, platforms: next.join(", ") }))}
                    ariaLabel="Platforms"
                  />
                ) : row.key === "deliverables" ? (
                  <IntakeOptionChips
                    options={INTAKE_DELIVERABLE_OPTIONS}
                    selected={splitList(draft.deliverables)}
                    onChange={(next) =>
                      setDraft((prev) => ({ ...prev, deliverables: next.join(", ") }))
                    }
                    ariaLabel="Deliverables"
                  />
                ) : row.key === "kpis" ? (
                  <IntakeOptionChips
                    options={INTAKE_KPI_OPTIONS}
                    selected={splitList(draft.kpis)}
                    onChange={(next) => setDraft((prev) => ({ ...prev, kpis: next.join(", ") }))}
                    ariaLabel="Success measurement / KPIs"
                  />
                ) : (
                  <Input
                    className="h-8 text-sm"
                    value={
                      row.key === "client"
                        ? draft.client
                        : row.key === "campaign"
                          ? draft.campaign
                          : row.key === "brand"
                            ? draft.brand
                            : row.key === "country"
                              ? draft.country
                              : row.key === "objective"
                                ? draft.objective
                                : row.key === "audience"
                                  ? draft.audience
                                  : row.key === "category" || row.key === "creatorCategories"
                                    ? draft.category
                                    : row.key === "platforms"
                                      ? draft.platforms
                                      : draft.deliverables
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft((prev) => {
                        if (row.key === "client") return { ...prev, client: value };
                        if (row.key === "campaign") return { ...prev, campaign: value };
                        if (row.key === "brand") return { ...prev, brand: value };
                        if (row.key === "country") return { ...prev, country: value };
                        if (row.key === "objective") return { ...prev, objective: value };
                        if (row.key === "audience") return { ...prev, audience: value };
                        if (row.key === "category" || row.key === "creatorCategories") {
                          return { ...prev, category: value };
                        }
                        if (row.key === "platforms") return { ...prev, platforms: value };
                        return { ...prev, deliverables: value };
                      });
                    }}
                    aria-label={row.label}
                    placeholder={row.state === "missing" ? "Missing" : undefined}
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {intake.missing.length > 0 ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Missing: {intake.missing.map((row) => row.label).join(", ")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {confirmed
              ? "Campaign Facts are confirmed. Next: Strategy."
              : "Required facts are present. Confirm before Strategy."}
          </p>
        )}
        {confirmed ? (
          <Button
            type="button"
            size="lg"
            onClick={() => onNavigateStep?.("strategy")}
            className="bg-[#0057FF] hover:bg-[#0040CC]"
          >
            <ArrowRightIcon className="size-4" />
            Next: Strategy
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="lg"
              disabled={pending || !conversationId || !intake.canConfirm}
              onClick={confirmCampaign}
              className="bg-[#0057FF] hover:bg-[#0040CC]"
            >
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />}
              Confirm campaign
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              disabled
              title="Confirm campaign facts first"
            >
              <ArrowRightIcon className="size-4" />
              Next: Strategy
            </Button>
          </div>
        )}
      </div>
      {cipState?.profile && isCampaignIntelligenceConfirmed(cipState.profile) ? (
        <p className="text-xs text-muted-foreground">Campaign Intelligence is already confirmed.</p>
      ) : null}
    </div>
  );
}
