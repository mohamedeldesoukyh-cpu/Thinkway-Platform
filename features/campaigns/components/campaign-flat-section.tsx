"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CampaignFlatSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Operational card section — matches assignments tab section rhythm. */
export function CampaignFlatSection({
  title,
  description,
  actions,
  children,
  className,
}: CampaignFlatSectionProps) {
  return (
    <section className={cn("min-w-0", className)}>
      <Card className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <CardHeader
          className={cn(
            "flex flex-row flex-wrap items-start justify-between gap-2 border-b border-border/40 px-4 py-3 md:px-5",
            actions ? "space-y-0" : undefined
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </CardTitle>
            {description ? (
              <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </CardHeader>
        <CardContent className="px-4 py-4 md:px-5">{children}</CardContent>
      </Card>
    </section>
  );
}
