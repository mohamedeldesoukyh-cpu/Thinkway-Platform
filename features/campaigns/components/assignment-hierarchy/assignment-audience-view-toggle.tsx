"use client";

import { EyeIcon, ShieldIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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

export function AssignmentAudienceViewToggle({
  value,
  onChange,
  className,
}: AssignmentAudienceViewToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border/70 bg-muted/30 p-0.5",
        className
      )}
      role="group"
      aria-label="Assignment audience view"
    >
      {(["internal", "client"] as const).map((option) => {
        const active = value === option;
        const Icon = option === "internal" ? ShieldIcon : EyeIcon;
        return (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={active ? "default" : "ghost"}
            className={cn(
              "h-7 gap-1.5 px-2.5 text-xs",
              !active && "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={() => onChange(option)}
          >
            <Icon className="size-3.5" aria-hidden />
            {ASSIGNMENT_AUDIENCE_VIEW_LABELS[option]}
          </Button>
        );
      })}
    </div>
  );
}
