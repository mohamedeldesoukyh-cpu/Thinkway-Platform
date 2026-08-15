"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
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
import { isCampaignIntelligenceConfirmed } from "@/features/campaign-intelligence-profile/services/campaign-facts-spine";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import {
  confirmStudioIntakeAction,
  patchStudioIntakeFactsAction,
} from "../../actions/confirm-studio-intake-action";
import {
  requiredIntakeFacts,
  type IntakeFactsEdit,
} from "../../services/studio-intake-facts";
import { isStudioIntakeConfirmed } from "../../services/studio-workspace-status";
import { CampaignBriefCard } from "../sections/campaign-brief-card";

type IntakeScreenProps = {
  campaignObject?: CampaignObject;
  conversationId?: string;
  messageId?: string;
  onCampaignObjectUpdated?: (campaignObject: Record<string, unknown>) => void;
};

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function IntakeScreen({
  campaignObject,
  conversationId,
  messageId,
  onCampaignObjectUpdated,
}: IntakeScreenProps) {
  const facts = getCampaignFacts(campaignObject);
  const intake = useMemo(() => requiredIntakeFacts(facts), [facts]);
  const confirmed = isStudioIntakeConfirmed(campaignObject);
  const [pending, startTransition] = useTransition();
  const [cipState, setCipState] = useState<CampaignIntelligenceWorkspaceState | null>(null);
  const [draft, setDraft] = useState({
    client: facts?.clientName ?? "",
    campaign: facts?.product ?? "",
    brand: facts?.brandName ?? "",
    country: (facts?.geography ?? []).join(", "),
    budget: facts?.budget?.amount?.toString() ?? "",
    currency: facts?.budget?.currency ?? "EGP",
    durationWeeks: facts?.durationWeeks?.toString() ?? "",
    objective: facts?.objective ?? "",
    audience: facts?.audience ?? "",
    category: facts?.industry ?? "",
    platforms: (facts?.platforms ?? []).join(", "),
    deliverables: (facts?.deliverables ?? []).join(", "),
  });

  useEffect(() => {
    setDraft({
      client: facts?.clientName ?? "",
      campaign: facts?.product ?? "",
      brand: facts?.brandName ?? "",
      country: (facts?.geography ?? []).join(", "),
      budget: facts?.budget?.amount?.toString() ?? "",
      currency: facts?.budget?.currency ?? "EGP",
      durationWeeks: facts?.durationWeeks?.toString() ?? "",
      objective: facts?.objective ?? "",
      audience: facts?.audience ?? "",
      category: facts?.industry ?? "",
      platforms: (facts?.platforms ?? []).join(", "),
      deliverables: (facts?.deliverables ?? []).join(", "),
    });
  }, [facts]);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    void getConversationCampaignIntelligenceAction(conversationId).then((row) => {
      if (cancelled || !row) return;
      setCipState({
        profileId: row.id,
        profile: row.profile,
        fileName: row.title ?? null,
        fileSizeBytes: null,
        hasExtractedData: true,
        parsedTextLength: 0,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const creatorsData = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  const profileId = cipState?.profileId ?? creatorsData.cipProfileId;

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
      if (facts) {
        const patched = await patchStudioIntakeFactsAction({
          conversationId,
          edit: editFromDraft(),
        });
        if (!patched.ok) {
          toast.error(patched.message);
          return;
        }
        onCampaignObjectUpdated?.(patched.campaignObject);
      }
      const result = await confirmStudioIntakeAction({
        conversationId,
        profileId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onCampaignObjectUpdated?.(result.campaignObject);
      toast.success(result.message);
    });
  }

  return (
    <div className="min-w-0 space-y-5">
      <CampaignBriefCard
        campaignObject={campaignObject}
        conversationId={conversationId}
        messageId={messageId}
        onBriefApplied={onCampaignObjectUpdated}
      />

      {conversationId ? (
        <CampaignIntelligencePanel
          key={cipState?.profileId ?? "cip-empty"}
          variant="inline"
          actions="none"
          initialState={cipState}
          onWorkspaceChange={setCipState}
        />
      ) : null}

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
                  <Input
                    className="h-8 text-sm"
                    value={draft.durationWeeks}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, durationWeeks: event.target.value }))
                    }
                    aria-label="Duration in weeks"
                    placeholder="Weeks — do not invent"
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
              ? "Campaign Facts are the source of truth for every later step."
              : "Required facts are present. Confirm before Strategy."}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          disabled={pending || (!intake.canConfirm && !facts)}
          onClick={confirmCampaign}
          className="bg-[#0057FF] hover:bg-[#0040CC]"
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />}
          Confirm campaign
        </Button>
      </div>
      {cipState?.profile && isCampaignIntelligenceConfirmed(cipState.profile) ? (
        <p className="text-xs text-muted-foreground">Campaign Intelligence is already confirmed.</p>
      ) : null}
    </div>
  );
}
