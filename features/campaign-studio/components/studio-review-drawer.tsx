"use client";

import { XIcon } from "lucide-react";

import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import type { StudioWorkspaceStepId } from "../constants/studio-workspace";
import { cn } from "@/lib/utils";

export type StudioReviewFinding = {
  id: string;
  severity: "hi" | "md";
  title: string;
  detail: string;
  whatToDo?: string;
  fixTarget?: StudioWorkspaceStepId;
};

type StudioReviewDrawerProps = {
  open: boolean;
  findings: StudioReviewFinding[];
  onClose: () => void;
  onNavigate?: (stepId: StudioWorkspaceStepId) => void;
};

/**
 * Presentation-only review drawer. Findings are projected from existing
 * freshness / package-readiness / director sources — no parallel issue SSOT.
 */
export function StudioReviewDrawer({
  open,
  findings,
  onClose,
  onNavigate,
}: StudioReviewDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className={STUDIO_REF_CLASSES.reviewScrim}
        aria-label="Close review"
        onClick={onClose}
      />
      <aside
        className={STUDIO_REF_CLASSES.reviewDrawer}
        role="dialog"
        aria-label="Review"
      >
        <div className={STUDIO_REF_CLASSES.reviewDrawerHead}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3>Review</h3>
              <p>
                {findings.length === 0
                  ? "No open attention items — package checks look clear."
                  : `${findings.length} item${findings.length === 1 ? "" : "s"} need attention before the package is ready.`}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B]"
              onClick={onClose}
              aria-label="Close"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        </div>
        <div className={STUDIO_REF_CLASSES.reviewDrawerBody}>
          {findings.map((f) => (
            <div key={f.id} className={STUDIO_REF_CLASSES.finding}>
              <div className={STUDIO_REF_CLASSES.findingTitle}>
                <span
                  className={cn(
                    STUDIO_REF_CLASSES.severity,
                    f.severity === "hi"
                      ? STUDIO_REF_CLASSES.severityHi
                      : STUDIO_REF_CLASSES.severityMd
                  )}
                >
                  {f.severity === "hi" ? "Decide" : "Check"}
                </span>
                <b>{f.title}</b>
              </div>
              <p>{f.detail}</p>
              {f.whatToDo ? (
                <>
                  <span className={STUDIO_REF_CLASSES.findingWhat}>What to do</span>
                  <p>{f.whatToDo}</p>
                </>
              ) : null}
              {f.fixTarget && onNavigate ? (
                <button
                  type="button"
                  className={cn(STUDIO_REF_CLASSES.reviewFlag, "mt-3")}
                  onClick={() => {
                    onNavigate(f.fixTarget!);
                    onClose();
                  }}
                >
                  Go to {f.fixTarget}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
