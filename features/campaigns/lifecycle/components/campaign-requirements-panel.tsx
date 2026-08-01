"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  /** Compact mode omits fields already shown in Decision Center / State Strip. */
  compact?: boolean;
  className?: string;
};

/** Explains stage requirements — compact when Decision Center owns next-action copy. */
export function CampaignRequirementsPanel({
  lifecycle,
  compact = false,
  className,
}: Props) {
  const completed = lifecycle.requirements.filter((item) => item.met);
  const missing = lifecycle.requirements.filter((item) => !item.met);

  return (
    <section
      className={cn("thinkway-lc-requirements", compact && "is-compact", className)}
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

        {!compact ? (
          <>
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
          </>
        ) : (
          <div>
            <div className="thinkway-bp-label">Expected Outcome</div>
            <p>{lifecycle.expectedResult}</p>
          </div>
        )}
      </div>
    </section>
  );
}
