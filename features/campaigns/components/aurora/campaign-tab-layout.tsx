"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CampaignTabLayoutProps = {
  tabs: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Aurora workspace panel shell — tab rail + body.
 * Presentation only; does not own tab state or data.
 */
export function CampaignTabLayout({ tabs, children, className }: CampaignTabLayoutProps) {
  return (
    <div className={cn("thinkway-aurora-panel", className)}>
      <div className="thinkway-aurora-panel-tabs">{tabs}</div>
      <div className="thinkway-aurora-panel-body">{children}</div>
    </div>
  );
}

type CampaignSectionHeadProps = {
  title: string;
  subtitle?: string;
  tools?: ReactNode;
  className?: string;
};

export function CampaignSectionHead({
  title,
  subtitle,
  tools,
  className,
}: CampaignSectionHeadProps) {
  return (
    <div className={cn("thinkway-aurora-sechead", className)}>
      <div className="thinkway-aurora-sechead-tt">{title}</div>
      {subtitle ? <span className="thinkway-aurora-sechead-sub">{subtitle}</span> : null}
      {tools ? <div className="thinkway-aurora-sechead-tools">{tools}</div> : null}
    </div>
  );
}
