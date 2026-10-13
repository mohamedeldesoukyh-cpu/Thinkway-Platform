"use client";

import type { ReactNode } from "react";

type CampaignWorkspaceScrollShellProps = {
  chrome: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
};

/**
 * One scroll surface: full context scrolls away; its compact visual summary and
 * tab rail pin without changing the full header's layout height.
 */
export function CampaignWorkspaceScrollShell({
  chrome,
  tabs,
  children,
}: CampaignWorkspaceScrollShellProps) {
  return (
    <div
      className="flex h-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--camp-surface)]"
      data-campaign-persistent-shell="true"
    >
      <div className="thinkway-aurora-wrap flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className="thinkway-aurora-panel min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain overscroll-x-none pb-11 [overscroll-behavior-x:none] [touch-action:pan-y]"
          data-campaign-workspace-scroll
          data-campaign-shell="content"
          role="region"
          aria-label="Campaign workspace content"
        >
        <div className="thinkway-campaign-header shrink-0" data-campaign-shell="chrome">
          {chrome}
        </div>
        {tabs ? (
          <div
            className="thinkway-aurora-panel-tabs thinkway-campaign-workspace-tabs-pinned shrink-0"
            data-campaign-shell="tabs"
            data-sticky="campaign-workspace-tabs"
            data-pinned="true"
          >
            {tabs}
          </div>
        ) : null}
          <div className="thinkway-aurora-panel-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
