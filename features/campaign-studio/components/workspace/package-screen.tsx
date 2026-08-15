"use client";

import { useState, type ReactNode } from "react";
import { CheckIcon, Loader2Icon, RefreshCwIcon, SendIcon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { regenerateStaleOutputsAction } from "@/features/campaign-outputs/actions/regenerate-stale-outputs";

import type { CampaignStudioSectionId } from "../../types/campaign-studio";
import type { StudioWorkspaceStepId } from "../../constants/studio-workspace";
import {
  firstPackageFixTarget,
  resolveStudioPackageReadiness,
  STUDIO_PACKAGE_DIMENSION_LABEL,
} from "../../services/studio-package-readiness";

type PackageScreenProps = {
  campaignObject?: CampaignObject;
  conversationId?: string;
  outdatedSections: ReadonlySet<CampaignStudioSectionId>;
  sectionStatuses?: Partial<Record<CampaignStudioSectionId, string>>;
  onCampaignObjectUpdated?: (campaignObject: Record<string, unknown>) => void;
  onNavigateStep?: (stepId: StudioWorkspaceStepId) => void;
  timeline: ReactNode;
  presentation: ReactNode;
};

export function PackageScreen({
  campaignObject,
  conversationId,
  outdatedSections,
  sectionStatuses,
  onCampaignObjectUpdated,
  onNavigateStep,
  timeline,
  presentation,
}: PackageScreenProps) {
  const readiness = resolveStudioPackageReadiness(campaignObject, {
    outdatedSections,
    sectionStatuses,
  });
  const [busy, setBusy] = useState(false);
  const attention = readiness.checks.filter((check) => !check.ready);
  const canRegenerate = Boolean(conversationId && campaignObject?.id && attention.length > 0);

  async function regenerateAffected() {
    if (!conversationId || !campaignObject?.id || busy) return;
    setBusy(true);
    try {
      const result = await regenerateStaleOutputsAction({
        conversationId,
        campaignObjectId: campaignObject.id,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onCampaignObjectUpdated?.(result.campaignObject);
      toast.success(result.message);
    } finally {
      setBusy(false);
    }
  }

  function fixIssues() {
    const target = firstPackageFixTarget(readiness);
    if (onNavigateStep && target !== "package") {
      onNavigateStep(target);
      return;
    }
    const first = attention[0];
    toast.message(first?.label ?? "Fix issues", {
      description: first?.action ?? first?.reason ?? "Review the items that need attention.",
    });
  }

  function requestClientReview() {
    if (!readiness.canCreateClientReview) {
      toast.error("Cannot create client review.", {
        description:
          readiness.clientReviewBlockers.length > 0
            ? `${readiness.attentionCount} item${readiness.attentionCount === 1 ? "" : "s"} need attention:\n${readiness.clientReviewBlockers
                .map((item) => `- ${item}`)
                .join("\n")}`
            : readiness.headline,
      });
      return;
    }
    toast.message("Create Client Review is next.", {
      description:
        "Client Workspace is not in this Development slice. Package is the internal checkpoint.",
    });
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Campaign package
        </p>
        <h3 className="mt-1 text-xl font-extrabold tracking-tight">{readiness.headline}</h3>
        {readiness.attentionSummary ? (
          <p className="mt-1 text-sm text-muted-foreground">{readiness.attentionSummary}</p>
        ) : null}
        <ul className="mt-4 space-y-2.5">
          {readiness.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2 text-sm">
              <span
                className={
                  check.ready
                    ? "mt-0.5 text-[#0C9D57]"
                    : "mt-0.5 text-amber-600"
                }
              >
                {check.ready ? <CheckIcon className="size-4" /> : "–"}
              </span>
              <span className="min-w-0">
                <span className="font-semibold">{check.label}</span>
                {check.ready ? null : (
                  <span className="ml-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {STUDIO_PACKAGE_DIMENSION_LABEL[check.state]}
                  </span>
                )}
                {check.reason && !check.ready ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {check.reason}
                    {check.action ? ` ${check.action}` : ""}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          {attention.length > 0 ? (
            <Button type="button" variant="outline" onClick={fixIssues}>
              <WrenchIcon className="size-4" />
              Fix issues
            </Button>
          ) : null}
          {canRegenerate ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void regenerateAffected()}>
              {busy ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              {busy ? "Regenerating…" : "Regenerate affected"}
            </Button>
          ) : null}
          <Button
            type="button"
            className="bg-[#0057FF] hover:bg-[#0040CC]"
            disabled={!readiness.canCreateClientReview}
            onClick={requestClientReview}
          >
            <SendIcon className="size-4" />
            Create client review
          </Button>
        </div>
        {!readiness.canCreateClientReview && readiness.clientReviewBlockers.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Cannot create client review. {readiness.attentionSummary ?? "Items need attention"}:{" "}
            {readiness.clientReviewBlockers.slice(0, 3).join(" ")}
          </p>
        ) : null}
      </section>

      <details className="rounded-2xl border border-border/70 bg-card p-4">
        <summary className="cursor-pointer text-sm font-extrabold">Timeline</summary>
        <div className="mt-3 min-w-0">{timeline}</div>
      </details>

      <div className="min-w-0">{presentation}</div>
    </div>
  );
}
