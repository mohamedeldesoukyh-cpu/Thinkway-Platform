"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  className?: string;
};

/** Explains stage requirements, missing items, reason, action, owner, outcome. */
export function CampaignRequirementsPanel({ lifecycle, className }: Props) {
  const completed = lifecycle.requirements.filter((item) => item.met);
  const missing = lifecycle.requirements.filter((item) => !item.met);

  return (
    <section
      className={cn("thinkway-lc-requirements", className)}
      aria-label={`${lifecycle.businessStageLabel} requirements`}
    >
      <div className="thinkway-lc-requirements-head">
        <h3>{lifecycle.businessStageLabel}</h3>
        <span className="thinkway-lc-pill">{lifecycle.businessStateLabel}</span>
      </div>

      <div className="thinkway-lc-requirements-grid">
        <div>
          <div className="thinkway-bp-label">Completed</div>
          {completed.length > 0 ? (
            <ul className="thinkway-lc-req-list">
              {completed.map((item) => (
                <li key={item.id} data-met="true">
                  <span aria-hidden>✓</span>
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="thinkway-lc-muted">None yet.</p>
          )}
        </div>

        <div>
          <div className="thinkway-bp-label">Missing</div>
          {missing.length > 0 ? (
            <ul className="thinkway-lc-req-list">
              {missing.map((item) => (
                <li key={item.id} data-met="false">
                  <span aria-hidden>○</span>
                  {item.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="thinkway-lc-muted">All requirements met.</p>
          )}
        </div>

        <div>
          <div className="thinkway-bp-label">
            {lifecycle.businessState === "blocked" ? "Hard blockers" : "Why here"}
          </div>
          {lifecycle.businessState === "blocked" && lifecycle.blockers.length > 0 ? (
            <ul className="thinkway-lc-blocker-list">
              {lifecycle.blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>{lifecycle.reason}</p>
          )}
        </div>

        <div>
          <div className="thinkway-bp-label">Next Action</div>
          <p className="font-semibold">{lifecycle.nextAction}</p>
          <p className="thinkway-lc-muted mt-1">Owner: {lifecycle.owner}</p>
        </div>

        <div>
          <div className="thinkway-bp-label">Expected Outcome</div>
          <p>{lifecycle.expectedResult}</p>
        </div>

        <div>
          <div className="thinkway-bp-label">Enforcement</div>
          <p className="capitalize">
            {lifecycle.mandatory ? "Mandatory" : "Optional"} · {lifecycle.enforcement}
            {lifecycle.enforcement !== "hard" ? " (soft — work can continue)" : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
