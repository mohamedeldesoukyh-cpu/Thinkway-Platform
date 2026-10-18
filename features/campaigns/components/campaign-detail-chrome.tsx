
import { CampaignRevenueShare } from "./campaign-revenue-share";
import { CampaignSummaryMoney } from "@/features/campaigns/components/campaign-money";
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
import { formatPercent } from "@/features/campaigns/utils";
import styles from "./campaign-commercial-header.module.css";
import { campaignDetailPath } from "@/lib/routing/entity-paths";
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
  const displayCurrency = (workspace.currency_code || "EGP").toUpperCase();
  const [currencyPending, startCurrencyTransition] = useTransition();

  const refreshWorkspace = () => {
    // A full reload avoids a stale RSC cache while retaining the complete URL,
    // including the active workspace and Finance section query parameters.
    window.location.reload();
  };


  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(
      "[data-campaign-workspace-scroll]"
    );
    const chrome = document.querySelector<HTMLElement>(
      "[data-campaign-shell='chrome']"
    );
    if (!scroller || !chrome) return;

    let upwardIntent = false;
    let touchY = 0;
    const headerHeight = () => chrome.querySelector<HTMLElement>(".tw-mast")?.offsetHeight ?? 300;
    let miniState = scroller.scrollTop > headerHeight() - 8;
    let armTimer: number | null = null;
    setMini(miniState);
    setTopArmed(true);

    const disarmTopBriefly = () => {
      setTopArmed(false);
      if (armTimer != null) window.clearTimeout(armTimer);
      // Prevent Back/Campaigns from capturing the click that ends a scroll
      // gesture when mini chrome expands and .tw-top reappears under the cursor.
      armTimer = window.setTimeout(() => setTopArmed(true), 400);
    };

    // Expanding the content viewport can clamp scrollTop on short panels.
    // Only user upward intent may expand the header; never resize feedback.
    const onWheel = (event: WheelEvent) => { upwardIntent = event.deltaY < 0; if (upwardIntent) onScroll(); };
    const onTouchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; };
    const onTouchMove = (event: TouchEvent) => { const next = event.touches[0]?.clientY ?? touchY; upwardIntent = next > touchY; touchY = next; if (upwardIntent) onScroll(); };
    const onKeyDown = (event: KeyboardEvent) => { upwardIntent = ['ArrowUp', 'PageUp', 'Home'].includes(event.key); if (upwardIntent) onScroll(); };
    const onScroll = () => {
      const y = scroller.scrollTop;
      // Hysteresis avoids mini on/off chatter near the threshold.
      const nextMini = miniState ? !(upwardIntent && y < headerHeight() - 56) : y > headerHeight() - 8;
      if (nextMini === miniState) return;
      miniState = nextMini;
      setMini(nextMini);
      if (!nextMini) disarmTopBriefly();
      else setTopArmed(true);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("wheel", onWheel, { passive: true });
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: true });
    scroller.addEventListener("keydown", onKeyDown);
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("keydown", onKeyDown);
      scroller.removeEventListener("scroll", onScroll);
      if (armTimer != null) window.clearTimeout(armTimer);
    };
  }, []);

  const { revenue, cost, gp } = workspace.financials;
  const agencyFees = workspace.financials.agency_fees ?? 0;
  const clientCost = workspace.financials.client_cost_before_agency_fees ?? revenue - agencyFees;
  const fxGainLoss = workspace.financials.fx_gain_loss_egp;
  const marginPercent = revenue > 0 ? gp / revenue * 100 : 0;
  const markupPercent = cost > 0 ? gp / cost * 100 : null;
  const headerMoney = (amount: number) => <><span className={styles.currency}>{displayCurrency}</span>{amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}</>;

  const handleCurrencyChange = (currency: string) => {
    const next = currency.toUpperCase();
    startCurrencyTransition(async () => {
      const saveRes = await updateCampaignDisplayCurrencyAction({ campaignId: workspace.id, currency: next });
      if (!saveRes.ok) {
        toast.error(saveRes.message ?? "Failed to update currency.");
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
      <div className={cn("wr-campaign-minibar", mini && "is-visible")} aria-hidden="true">
        <div className="wr-campaign-minibar-inner">
          <div className="wr-campaign-minibar-title"><span><DocumentNumber value={workspace.document_number} /></span><b>{workspace.name}</b><span>{lifecycle.businessStateLabel}</span></div>
          <div className="wr-campaign-minibar-figures">
            <span className="wr-mini-internal"><i>Internal</i><span>Base cost <b><CampaignSummaryMoney amount={cost} currency={displayCurrency} metric="cost" /></b></span><span>GP <b><CampaignSummaryMoney amount={gp} currency={displayCurrency} metric="gp" /></b></span><span>GP % <b>{formatPercent(marginPercent)}</b></span></span>
            <span><i>Client-facing</i><span>Total investment <b><CampaignSummaryMoney amount={revenue} currency={displayCurrency} metric="revenue" /></b></span><span>Creators <b>{String(workspace.lines.length)}</b></span></span>
          </div>
        </div>
      </div>
      <div className="tw-mast">
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
        <button
          type="button"
          className="tw-b sm"
          onClick={refreshWorkspace}
          title="Refresh this workspace"
        >
          Refresh
        </button>
        <span className="tw-p p-b">{titleCaseStatus(workspace.status)}</span>
        <EnvironmentBadgeSlot />
      </div>

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
          <span className="tw-sp" />
          {blocked ? <span className="st r">Blocked</span> : null}
          <button type="button" className="tw-b pri" onClick={onOpenDetails}>Campaign details</button>
        </div>

        {identityMeta ? <div className="wr-campaign-context">{identityMeta}</div> : null}

        <div className="tw-mr">{actions}<span className="wr-tools-divider" /><button type="button" className="tw-b" onClick={() => onSelectStage("lines")}>Commercial Workspace</button></div>

        <div className={styles.context}>
          <span><b>{workspace.lines.length}</b> creator line(s)</span>
          <span>Stage: <b>{lifecycle.businessStageLabel}</b></span>
          <span>Workspace: <b>{workspaceLabelForTab(activeTab)}</b></span>
          <span className={styles.fx}>Internal FX gain / loss: <b>{fxGainLoss == null ? "Not available" : `EGP ${fxGainLoss.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}</b></span>
        </div>
        <div className={styles.metrics} role="group" aria-label="Campaign commercial metrics">
          <section className={styles.private} aria-label="Internal financial metrics">
            <div className={styles.band}>Internal — never shown to the client</div>
            <div className={styles.cells}>
              <div><span className={styles.label}>Base cost (internal creator / vendor cost)</span><b>{headerMoney(cost)}</b></div>
              <div><span className={styles.label}>GP amount · after RS</span><b className={gp < 0 ? styles.negative : agencyFees > 0 ? styles.amber : styles.positive}>{headerMoney(gp)}</b></div>
              <div><span className={styles.label}>GP % · after RS</span><b className={gp < 0 ? styles.negative : agencyFees > 0 ? styles.amber : styles.positive}>{marginPercent.toFixed(1)}%</b></div>
              <div><span className={styles.label}>Revenue share</span><b className={styles.negative}>{(workspace.financials.revenue_share ?? 0) > 0 ? "−" : ""}{headerMoney(workspace.financials.revenue_share ?? 0)}</b><CampaignRevenueShare campaignId={workspace.id} amountLabel="Edit revenue share" /></div>
              <div><span className={styles.label}>Markup / FM %</span><b title="GP divided by base cost">{markupPercent == null ? "—" : `${markupPercent.toFixed(1)}%`}</b></div>
            </div>
          </section>
          <section aria-label="Client-facing metrics">
            <div className={styles.band}>Client-facing</div>
            <div className={styles.cells}>
              <div><span className={styles.label}>Display currency</span><CommercialCurrencySelect appearance="header" label={null} layout="inline" value={displayCurrency} onChange={handleCurrencyChange} disabled={currencyPending} /></div>
              <div><span className={styles.label}>Client cost before agency fees</span><b>{headerMoney(clientCost)}</b></div>
              <div><span className={styles.label}>Agency fees (AF)</span><b>{headerMoney(agencyFees)}</b></div>
              <div><span className={styles.label}>Total investment</span><b>{headerMoney(revenue)}</b></div>
            </div>
          </section>
        </div>
      </div>

        <div className={cn("tw-mb wr-decision", blocked ? "wr-decision-blocked" : "wr-decision-ready")}>
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
          <span className="wr-decision-meta"><span><i>State</i>{lifecycle.businessStateLabel}</span><span><i>Waiting for</i>{intel.waitingFor}</span><span><i>Waiting</i>{intel.daysWaitingLabel || "—"}</span><span><i>Risk</i>{intel.riskLabel}</span></span>
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


      {stepper}


    </div>
  );
}
