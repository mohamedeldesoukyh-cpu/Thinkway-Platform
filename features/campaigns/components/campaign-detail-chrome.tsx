"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EntityPrevNext } from "@/components/navigation/entity-prev-next";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentNumber } from "@/components/ui/document-number";
import { EnvironmentBadgeSlot } from "@/components/environment/environment-badge-slot";
import { CommercialCurrencySelect } from "@/features/commercial/components/commercial-currency-select";
import { CampaignWorkspaceJumpSelect } from "@/features/campaigns/components/campaign-workspace-jump-select";
import { updateCampaignDisplayCurrencyAction } from "@/features/campaigns/actions";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import { workspaceLabelForTab } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignDecisionCenterPanel } from "@/features/campaigns/lifecycle/components/campaign-decision-center-panel";
import { portfolioIntelFromLifecycle } from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import type { DecisionFocusQuery } from "@/features/campaigns/lifecycle/campaign-decision-center";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoneyCompact, formatPercent } from "@/features/campaigns/utils";
import { fromEgp } from "@/lib/commercial/fx-aggregation";
import { resolveCommercialRateToEgp } from "@/features/quotations/actions";
import { campaignDetailPath } from "@/lib/routing/entity-paths";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { cn } from "@/lib/utils";

type CampaignDetailChromeProps = {
  workspace: CampaignWorkspace;
  lifecycle: CampaignLifecycleView;
  activeTab: CampaignWorkspaceTabId;
  actions: ReactNode;
  stepper: ReactNode;
  onContinue: () => void;
  onOpenResolver?: () => void;
  onSelectStage: (
    tab: CampaignWorkspaceTabId,
    focus?: DecisionFocusQuery | null
  ) => void;
  onOpenDetails: () => void;
  /** Opens campaign name / header edit without requiring Overview scroll. */
  onEditHeader: () => void;
};

function titleCaseStatus(value: string): string {
  if (!value) return value;
  return value.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function CampaignDetailChrome({
  workspace,
  lifecycle,
  activeTab,
  actions,
  stepper,
  onContinue,
  onOpenResolver,
  onSelectStage,
  onOpenDetails,
  onEditHeader,
}: CampaignDetailChromeProps) {
  const router = useRouter();
  const dc = lifecycle.decisionCenter;
  const narrative = dc.narrative;
  const intel = portfolioIntelFromLifecycle(lifecycle, {
    updatedAt: workspace.activity[0]?.created_at ?? workspace.start_date,
    endDate: workspace.end_date,
  });
  const blocked = !narrative.progressionAllowed;
  const identityMeta = [
    workspace.brand?.name,
    workspace.client?.name,
    workspace.group?.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const [mini, setMini] = useState(false);
  const [topArmed, setTopArmed] = useState(true);
  const [dcOpen, setDcOpen] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState(
    (workspace.currency_code || "EGP").toUpperCase()
  );
  const [displayFxRateToEgp, setDisplayFxRateToEgp] = useState(
    Number(workspace.financials.display_fx_rate_to_egp) > 0
      ? Number(workspace.financials.display_fx_rate_to_egp)
      : 1
  );
  const [currencyPending, startCurrencyTransition] = useTransition();

  useEffect(() => {
    setDisplayCurrency((workspace.currency_code || "EGP").toUpperCase());
    setDisplayFxRateToEgp(
      Number(workspace.financials.display_fx_rate_to_egp) > 0
        ? Number(workspace.financials.display_fx_rate_to_egp)
        : 1
    );
  }, [workspace.currency_code, workspace.financials.display_fx_rate_to_egp]);

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(
      "[data-campaign-workspace-scroll]"
    );
    const chrome = document.querySelector<HTMLElement>(
      "[data-campaign-shell='chrome']"
    );
    if (!scroller || !chrome) return;

    let lastHeight = chrome.getBoundingClientRect().height;
    let miniState = scroller.scrollTop > 96;
    let armTimer: number | null = null;
    setMini(miniState);
    setTopArmed(!miniState);

    const disarmTopBriefly = () => {
      setTopArmed(false);
      if (armTimer != null) window.clearTimeout(armTimer);
      // Prevent Back/Campaigns from capturing the click that ends a scroll
      // gesture when mini chrome expands and .tw-top reappears under the cursor.
      armTimer = window.setTimeout(() => setTopArmed(true), 400);
    };

    const ro = new ResizeObserver(() => {
      const next = chrome.getBoundingClientRect().height;
      const delta = lastHeight - next;
      lastHeight = next;
      // Chrome sits above the scroller — when it shrinks/grows, keep the same
      // content under the cursor so Assignments/Vendor IO don't jump upward.
      if (Math.abs(delta) > 1) {
        scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
      }
    });
    ro.observe(chrome);

    const onScroll = () => {
      const y = scroller.scrollTop;
      // Hysteresis avoids mini on/off chatter near the threshold.
      const nextMini = miniState ? y > 40 : y > 96;
      if (nextMini === miniState) return;
      miniState = nextMini;
      setMini(nextMini);
      if (!nextMini) disarmTopBriefly();
      else setTopArmed(false);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      if (armTimer != null) window.clearTimeout(armTimer);
    };
  }, []);

  const revenue = fromEgp(
    Number(workspace.financials.revenue_egp ?? workspace.financials.revenue ?? 0),
    displayCurrency,
    displayFxRateToEgp
  );
  const cost = fromEgp(
    Number(workspace.financials.cost_egp ?? workspace.financials.cost ?? 0),
    displayCurrency,
    displayFxRateToEgp
  );
  const gp = fromEgp(
    Number(workspace.financials.gp_egp ?? workspace.financials.gp ?? 0),
    displayCurrency,
    displayFxRateToEgp
  );
  const marginPercent =
    revenue > 0
      ? Math.round((gp / revenue) * 10000) / 100
      : workspace.financials.margin_percent;

  const handleCurrencyChange = (currency: string) => {
    const next = currency.toUpperCase();
    const previous = displayCurrency;
    setDisplayCurrency(next);
    startCurrencyTransition(async () => {
      const [rateRes, saveRes] = await Promise.all([
        resolveCommercialRateToEgp(next),
        updateCampaignDisplayCurrencyAction({
          campaignId: workspace.id,
          currency: next,
        }),
      ]);
      if (rateRes.ok && rateRes.data) {
        setDisplayFxRateToEgp(rateRes.data.rate);
      }
      if (!saveRes.ok) {
        toast.error(saveRes.message ?? "Failed to update currency.");
        setDisplayCurrency(previous);
        return;
      }
      router.refresh();
    });
  };

  const stageCannotAdvance = `${narrative.currentStageLabel} cannot advance`;
  const decisionMsg = narrative.progressionAllowed
    ? narrative.currentStageComplete
      ? "May continue"
      : narrative.progressionLabel ?? "In progress"
    : stageCannotAdvance;

  return (
    <div className={cn("tw-frozen", mini && "is-mini")}>
      <div
        className={cn("tw-top", !topArmed && "tw-top-disarmed")}
        data-top-armed={topArmed ? "true" : "false"}
      >
        <PageBackButton
          fallbackHref="/campaigns"
          label="← Back"
          variant="text"
          className="tw-b sm"
        />
        <EntityPrevNext
          entity="campaigns"
          currentId={workspace.id}
          hrefForId={(id) => campaignDetailPath(id)}
          className="shrink-0"
        />
        <CampaignWorkspaceJumpSelect
          currentId={workspace.id}
          currentDocumentNumber={workspace.document_number}
          currentName={workspace.name}
        />
        <span className="tw-crumb">
          <Link href="/campaigns">Campaigns</Link>
          {" / "}
          <b>
            <DocumentNumber value={workspace.document_number} />
          </b>
          {" / "}
          {lifecycle.businessStageLabel}
        </span>
        <span className="tw-sp" />
        <span className="tw-p p-b">{titleCaseStatus(workspace.status)}</span>
        <EnvironmentBadgeSlot />
      </div>

      <div className="tw-mast">
        <div className="tw-mh">
          <span className="id">
            <DocumentNumber value={workspace.document_number} />
          </span>
          <button
            type="button"
            className="tw-name-edit"
            title="Edit campaign name"
            onClick={onEditHeader}
          >
            <h1>{workspace.name}</h1>
          </button>
          <span className="st">{lifecycle.businessStateLabel}</span>
          {identityMeta ? <span className="sub">{identityMeta}</span> : null}
          <span className="tw-sp" />
          {blocked ? <span className="st r">Blocked</span> : null}
        </div>

        <div className="tw-mb">
          <button
            type="button"
            className="lb"
            onClick={() => setDcOpen((open) => !open)}
            aria-expanded={dcOpen}
          >
            Decision center
          </button>
          <span>
            <span className="msg">{decisionMsg}</span>{" "}
            <span className="sub">
              {narrative.dependencyDetail}
              {narrative.ownerLabel ? ` · owner ${narrative.ownerLabel}` : ""}
              {narrative.waitingSince ? ` · ${narrative.waitingSince}` : ""}
            </span>
          </span>
          <span className="tw-sp" />
          <button type="button" className="go" onClick={onContinue}>
            {dc.primaryAction}
          </button>
        </div>

        {dcOpen ? (
          <div className="tw-dc-expand">
            <CampaignDecisionCenterPanel
              lifecycle={lifecycle}
              onPrimaryAction={onContinue}
              onOpenResolver={onOpenResolver}
              onNavigateToTab={onSelectStage}
              forceExpanded
            />
          </div>
        ) : null}

        <div className="tw-mr">{actions}</div>

        <div className="tw-ms2" role="group" aria-label="Campaign metrics">
          <div className="tw-ccy">
            <i>Ccy</i>
            <b className="s">
              <CommercialCurrencySelect
                label={null}
                layout="inline"
                value={displayCurrency}
                onChange={handleCurrencyChange}
                disabled={currencyPending}
              />
            </b>
          </div>
          <div>
            <i>Revenue</i>
            <b>{formatMoneyCompact(revenue, displayCurrency)}</b>
          </div>
          <div>
            <i>Cost</i>
            <b>{formatMoneyCompact(cost, displayCurrency)}</b>
          </div>
          <div>
            <i>Gross profit</i>
            <b className={gp >= 0 ? "g" : "r"}>
              {formatMoneyCompact(gp, displayCurrency)}
            </b>
          </div>
          <div>
            <i>Margin</i>
            <b className={marginPercent >= 20 ? "g" : undefined}>
              {formatPercent(marginPercent)}
            </b>
          </div>
          <div>
            <i>Stage</i>
            <b className="s">{lifecycle.businessStageLabel}</b>
          </div>
          <div>
            <i>State</i>
            <b className="s">{lifecycle.businessStateLabel}</b>
          </div>
          <div>
            <i>Waiting for</i>
            <b className="s">{intel.waitingFor}</b>
          </div>
          <div>
            <i>Days waiting</i>
            <b className="s">{intel.daysWaitingLabel || "—"}</b>
          </div>
          <div>
            <i>Risk</i>
            <b className="s">{intel.riskLabel}</b>
          </div>
          <div>
            <i>Creators</i>
            <b className="s">{String(workspace.lines.length)}</b>
          </div>
          <div>
            <i>Workspace</i>
            <b className="s">{workspaceLabelForTab(activeTab)}</b>
          </div>
        </div>
      </div>

      {stepper}

      <div className="tw-jump">
        <button type="button" onClick={() => onSelectStage("lines")}>
          Commercial Workspace
        </button>
        <button type="button" onClick={onOpenDetails}>
          Settings
        </button>
        <span className="sr-only">
          {formatDocumentNumberForDisplay(workspace.document_number)}
        </span>
      </div>
    </div>
  );
}
