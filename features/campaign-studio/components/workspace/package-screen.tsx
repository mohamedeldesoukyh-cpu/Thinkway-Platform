"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon, Link2Icon, Loader2Icon, RefreshCwIcon, SendIcon, WrenchIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { CampaignObject } from "@/features/campaign-intelligence";
import { createClientReviewAction } from "@/features/client-workspace/actions/create-client-review-action";
import { loadLatestClientReviewAction } from "@/features/client-workspace/actions/load-latest-client-review-action";
import { revealClientReviewLinkAction } from "@/features/client-workspace/actions/reveal-client-review-link-action";
import { ClientReviewShareDialog } from "@/features/client-workspace/components/client-review-share-dialog";
import {
  readClientReviewShare,
  rememberClientReviewShare,
  reviewIdFromShareUrl,
} from "@/features/client-workspace/client-review-share-memory";
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareReviewNumber, setShareReviewNumber] = useState<number | undefined>(undefined);
  const [clientReview, setClientReview] = useState<Awaited<
    ReturnType<typeof loadLatestClientReviewAction>
  >["review"]>(null);
  const attention = readiness.checks.filter((check) => !check.ready);
  const canRegenerate = Boolean(conversationId && campaignObject?.id && attention.length > 0);

  useEffect(() => {
    if (!campaignObject?.id) return;
    void loadLatestClientReviewAction(campaignObject.id).then((result) => {
      if (result.ok) setClientReview(result.review);
    });
  }, [campaignObject?.id]);

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

  async function requestClientReview() {
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
    if (!campaignObject || !conversationId || busy) {
      toast.error("Cannot create client review.", {
        description: "The campaign package is not available to freeze.",
      });
      return;
    }
    setBusy(true);
    try {
      const result = await createClientReviewAction({
        campaignObject,
        conversationId,
      });
      if (!result.ok) {
        toast.error(result.message, {
          description: result.blockers.slice(0, 4).join(" "),
        });
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
      } catch {
        /* clipboard is optional — the share dialog still shows the URL */
      }
      if (campaignObject.id) {
        const reviewId = reviewIdFromShareUrl(result.url) ?? campaignObject.id;
        rememberClientReviewShare(
          { source: "studio", id: campaignObject.id },
          { url: result.url, reviewNumber: result.reviewNumber, reviewId }
        );
      }
      setShareUrl(result.url);
      setShareReviewNumber(result.reviewNumber);
      setShareOpen(true);
      toast.success(result.message);
      if (campaignObject.id) {
        const latest = await loadLatestClientReviewAction(campaignObject.id);
        if (latest.ok) setClientReview(latest.review);
      }
    } finally {
      setBusy(false);
    }
  }

  async function showClientReviewLink() {
    if (!campaignObject?.id || busy) return;
    const cached = readClientReviewShare({ source: "studio", id: campaignObject.id });
    if (cached) {
      setShareUrl(cached.url);
      setShareReviewNumber(cached.reviewNumber);
      setShareOpen(true);
      return;
    }
    setBusy(true);
    try {
      const result = await revealClientReviewLinkAction({
        source: "studio",
        campaignObjectId: campaignObject.id,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      rememberClientReviewShare(
        { source: "studio", id: campaignObject.id },
        { url: result.url, reviewNumber: result.reviewNumber, reviewId: result.reviewId }
      );
      setShareUrl(result.url);
      setShareReviewNumber(result.reviewNumber);
      setShareOpen(true);
    } finally {
      setBusy(false);
    }
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
            disabled={!readiness.canCreateClientReview || busy}
            onClick={() => void requestClientReview()}
          >
            <SendIcon className="size-4" />
            Create client review
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!campaignObject?.id || busy}
            onClick={() => void showClientReviewLink()}
          >
            <Link2Icon className="size-4" />
            Show link
          </Button>
        </div>
        {!readiness.canCreateClientReview && readiness.clientReviewBlockers.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Cannot create client review. {readiness.attentionSummary ?? "Items need attention"}:{" "}
            {readiness.clientReviewBlockers.slice(0, 3).join(" ")}
          </p>
        ) : null}
        {clientReview ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Client review v{clientReview.reviewNumber}: {clientReview.status.replaceAll("_", " ")}.
            Selected {clientReview.accepted} · Rejected {clientReview.rejected} · In review {clientReview.inReview}
            {clientReview.changeRequestSummary ? ` · Requested changes: ${clientReview.changeRequestSummary}` : ""}
          </p>
        ) : null}
      </section>

      <details className="rounded-2xl border border-border/70 bg-card p-4">
        <summary className="cursor-pointer text-sm font-extrabold">Timeline</summary>
        <div className="mt-3 min-w-0">{timeline}</div>
      </details>

      <div className="min-w-0">{presentation}</div>
      <ClientReviewShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        reviewNumber={shareReviewNumber}
      />
    </div>
  );
}
