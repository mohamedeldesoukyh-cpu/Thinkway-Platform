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

/** Page-background frame with a white card inside. */
export function CampaignFlatSection({
  title,
  description,
  actions,
  children,
  className,
}: CampaignFlatSectionProps) {
  return (
    <section className={cn("min-w-0", className)}>
      <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
        <CardHeader
          className={cn(
            "flex flex-row flex-wrap items-start justify-between gap-2 pb-2",
            actions ? "space-y-0" : undefined
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
            {description ? (
              <p className="text-sm font-normal text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
