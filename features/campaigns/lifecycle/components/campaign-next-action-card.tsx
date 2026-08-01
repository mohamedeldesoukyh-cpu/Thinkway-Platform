"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  onContinue?: () => void;
  className?: string;
};

/** Primary operating-system CTA — the default user journey for the campaign. */
export function CampaignNextActionCard({ lifecycle, onContinue, className }: Props) {
  return (
    <section
      className={cn("thinkway-lc-next-action", className)}
      aria-label="Next action"
    >
      <div className="thinkway-lc-next-action-top">
        <div className="min-w-0">
          <div className="thinkway-lc-next-action-kicker">
            Default journey · {lifecycle.businessStageLabel}
          </div>
          <div className="thinkway-lc-next-action-title">{lifecycle.nextAction}</div>
          <p className="thinkway-lc-next-action-lead">
            Owner <b>{lifecycle.owner}</b>
            {lifecycle.waitingFor !== "None" ? (
              <>
                {" "}
                · Waiting <b>{lifecycle.waitingFor}</b>
              </>
            ) : null}
          </p>
        </div>
        {onContinue ? (
          <button
            type="button"
            className="thinkway-lc-next-action-cta"
            onClick={onContinue}
            title={lifecycle.reason}
          >
            <span className="thinkway-lc-next-action-cta-kicker">Take action</span>
            <span className="thinkway-lc-next-action-cta-label">{lifecycle.nextAction}</span>
          </button>
        ) : null}
      </div>

      <div className="thinkway-lc-next-action-grid">
        <div>
          <div className="thinkway-bp-label">Why required</div>
          <p>{lifecycle.reason}</p>
        </div>
        <div>
          <div className="thinkway-bp-label">After completion</div>
          <p>
            {lifecycle.expectedResult}
            {lifecycle.nextStageLabel ? ` Then: ${lifecycle.nextStageLabel}.` : ""}
          </p>
        </div>
        <div>
          <div className="thinkway-bp-label">Business state</div>
          <p>
            <span className="thinkway-lc-pill">{lifecycle.businessStateLabel}</span>
          </p>
        </div>
        <div>
          <div className="thinkway-bp-label">Requirements</div>
          <p>
            {lifecycle.requirements.filter((item) => item.met).length}/
            {lifecycle.requirements.length} complete
            {lifecycle.missing.length > 0
              ? ` · ${lifecycle.missing.length} missing`
              : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
