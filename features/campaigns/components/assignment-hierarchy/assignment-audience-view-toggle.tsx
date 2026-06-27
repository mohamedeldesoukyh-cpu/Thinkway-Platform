"use client";

import {
  ASSIGNMENT_AUDIENCE_VIEW_LABELS,
  type AssignmentAudienceView,
} from "@/lib/campaigns/assignment-audience-view";
import { cn } from "@/lib/utils";

type AssignmentAudienceViewToggleProps = {
  value: AssignmentAudienceView;
  onChange: (value: AssignmentAudienceView) => void;
  className?: string;
};

/** Internal / client view pills — matches thinkway-campaign_2.html view-toggle. */
export function AssignmentAudienceViewToggle({
  value,
  onChange,
  className,
}: AssignmentAudienceViewToggleProps) {
  return (
    <div
      className={cn("thinkway-campaign-view-toggle", className)}
      role="group"
      aria-label="Assignment audience view"
    >
      {(["internal", "client"] as const).map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            className={cn(
              "thinkway-campaign-view-btn",
              active && "thinkway-campaign-view-btn-active"
            )}
            aria-pressed={active}
            onClick={() => onChange(option)}
          >
            {ASSIGNMENT_AUDIENCE_VIEW_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
