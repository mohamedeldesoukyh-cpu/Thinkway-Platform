"use client";

import { useState } from "react";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Button } from "@/components/ui/button";
import { MediaPlanCalendar } from "@/features/campaign-outputs/components/media-plan-calendar";
import { ClientMediaPlanApprovalToolbar } from "@/features/portals/components/client-media-plan-approval-toolbar";
import { PortalStatusBadge } from "@/features/portals/components/portal-status-badge";
import type { ClientMediaPlanPayload } from "@/features/portals/queries/client-media-plan-payload";
import { cn } from "@/lib/utils";

type ClientMediaPlanViewProps = {
  payload: ClientMediaPlanPayload;
};

export function ClientMediaPlanView({ payload }: ClientMediaPlanViewProps) {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");

  const subtitle =
    payload.viewMode === "pending_review"
      ? "Proposed Original Media Plan · awaiting your decision"
      : "Original Media Plan";

  return (
    <div className="space-y-4">
      <PageBackButton
        fallbackHref="/client-portal/campaigns"
        label="Back to campaigns"
        variant="text"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {payload.campaignName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {subtitle}
            {payload.documentNumber ? (
              <>
                {" · "}
                <DocumentNumber value={payload.documentNumber} />
              </>
            ) : null}
            {payload.baselineVersion != null ? ` · Baseline v${payload.baselineVersion}` : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <PortalStatusBadge value={payload.statusLabel} />
            <span className="text-xs text-muted-foreground">
              {payload.viewMode === "pending_review" ? "Review mode" : "Read-only calendar"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <ClientMediaPlanApprovalToolbar payload={payload} />
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            {(["portrait", "landscape"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={orientation === mode ? "secondary" : "ghost"}
                className={cn("h-8 capitalize", orientation === mode && "shadow-sm")}
                onClick={() => setOrientation(mode)}
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {payload.emptyReason ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">{payload.emptyReason}</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-card">
          <MediaPlanCalendar
            data={payload.original}
            editable={false}
            orientation={orientation}
          />
        </div>
      )}
    </div>
  );
}
