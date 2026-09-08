"use client";

import { useMemo, useState } from "react";
import { CheckIcon, PencilIcon, SparklesIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { DirectorRecommendation, DirectorConfidence } from "../director/director-types";

const CONFIDENCE_CLASS: Record<DirectorConfidence, string> = {
  High: "hi",
  Medium: "md",
  Low: "lo",
};

export type DirectorRecommendationsPanelProps = {
  summary: string;
  recommendations: DirectorRecommendation[];
  /** Apply reuses the existing Copilot mutation + versioning. */
  onApply?: (command: string) => void;
};

/**
 * Surfaces the AI Campaign Director's recommendations inside the Studio. Reuses
 * the existing deterministic recommendation engine (passed in as data). Apply
 * dispatches the recommendation's proposedCommand through the existing Copilot,
 * so the mutation + versioning path is never duplicated. Modify edits the
 * command inline before applying; Dismiss is local.
 */
export function DirectorRecommendationsPanel({
  summary,
  recommendations,
  onApply,
}: DirectorRecommendationsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Record<string, string>>({});
  const visible = useMemo(
    () => recommendations.filter((rec) => !dismissed.has(rec.id)),
    [recommendations, dismissed]
  );

  return (
    <div className="cs-director space-y-5">
      <div className="cs-director__head flex items-center gap-2.5">
        <span className="cs-director__ico flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#5B3FD1] to-[#0057FF]">
          <SparklesIcon className="size-4 text-white" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0B0F1A]">
            AI Campaign Director
          </h2>
          <p className="text-[12px] leading-relaxed text-[#64748B]">{summary}</p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[12px] border border-[#E2E8F0] bg-[#F6F8FB] p-4 text-[13px] text-[#64748B]">
          No open recommendations — the campaign looks well-balanced.
        </p>
      ) : (
        <div className="cs-director__list">
          {visible.map((rec) => (
            <div key={rec.id} className="cs-rec2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[13.5px] font-semibold tracking-tight text-[#0B0F1A]">
                  {rec.title}
                </h3>
                <span className={cn("cs-sev shrink-0", CONFIDENCE_CLASS[rec.confidence])}>
                  {rec.confidence}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#41495A]">{rec.recommendation}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-[#64748B]">
                <span className="font-semibold text-[#41495A]">Reason:</span> {rec.reason}
              </p>
              {rec.evidence.length ? (
                <p className="mt-1 text-[11.5px] leading-relaxed text-[#64748B]">
                  <span className="font-semibold text-[#41495A]">Evidence:</span>{" "}
                  {rec.evidence.join("; ")}
                </p>
              ) : null}

              {rec.proposedCommand && editing[rec.id] !== undefined ? (
                <input
                  type="text"
                  value={editing[rec.id]}
                  onChange={(e) => setEditing((prev) => ({ ...prev, [rec.id]: e.target.value }))}
                  className="cs-rec2__input mt-3 w-full rounded-[9px] border border-[#E2E8F0] bg-white px-2.5 py-2 text-[12px] text-[#0B0F1A] outline-none focus:border-[rgba(0,87,255,0.45)] focus:shadow-[0_0_0_3px_rgba(0,87,255,0.12)]"
                  aria-label="Edit the command before applying"
                />
              ) : null}

              <div className="cs-rec2__actions mt-3 flex flex-wrap items-center gap-2">
                {rec.proposedCommand ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onApply?.(editing[rec.id] ?? rec.proposedCommand!)}
                      disabled={!onApply}
                      className="cs-rec2__apply"
                    >
                      <CheckIcon className="size-3.5" /> Apply
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing((prev) =>
                          rec.id in prev
                            ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== rec.id))
                            : { ...prev, [rec.id]: rec.proposedCommand! }
                        )
                      }
                      className="cs-rec2__modify"
                    >
                      <PencilIcon className="size-3.5" />{" "}
                      {editing[rec.id] !== undefined ? "Cancel" : "Modify"}
                    </button>
                  </>
                ) : (
                  <span className="cs-rec2__advisory">
                    Advisory — reflected when outputs regenerate
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => new Set(prev).add(rec.id))}
                  className="cs-rec2__dismiss ml-auto"
                >
                  <XIcon className="size-3.5" /> Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
