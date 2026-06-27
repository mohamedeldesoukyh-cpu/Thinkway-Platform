"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CampaignFlatSectionProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** info-card = overview grid cards; section-card = full-width sections */
  variant?: "section-card" | "info-card";
  /** Tables / activity lists flush to card edges (no section-body padding). */
  flushBody?: boolean;
};

/** Section shell — matches thinkway-campaign_2.html section-card / info-card. */
export function CampaignFlatSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  variant = "section-card",
  flushBody = false,
}: CampaignFlatSectionProps) {
  if (variant === "info-card") {
    return (
      <section className={cn("thinkway-campaign-info-card flex h-full min-w-0 flex-col", className)}>
        <h3>{title}</h3>
        {children}
      </section>
    );
  }

  return (
    <section className={cn("thinkway-campaign-section-card flex min-w-0 flex-col", className)}>
      <div className="thinkway-campaign-section-head">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? (
              <Icon className="size-3.5 shrink-0 text-[var(--camp-text-3)]" aria-hidden />
            ) : null}
            <h2>{title}</h2>
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {flushBody ? children : <div className="thinkway-campaign-section-body">{children}</div>}
    </section>
  );
}
