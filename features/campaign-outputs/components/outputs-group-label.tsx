"use client";

import { ArrowRightIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignOutputGroup } from "../output-types";
import {
  OUTPUTS_CLASSES,
  OUTPUTS_SECTION_COLORS,
  OUTPUTS_SECTION_NAV_HEIGHT,
  OUTPUTS_GROUP_LABEL_STEP,
} from "../constants/outputs-center-tokens";

export type OutputsGroupLabelProps = {
  group: CampaignOutputGroup;
  label: string;
  count: number;
  sectionIndex: number;
  icon?: LucideIcon;
  onJump?: () => void;
  className?: string;
};

/**
 * Sticky section header with left accent bar — matches reference group-label stacking.
 */
export function OutputsGroupLabel({
  group,
  label,
  count,
  sectionIndex,
  icon: Icon,
  onJump,
  className,
}: OutputsGroupLabelProps) {
  const borderColor = OUTPUTS_SECTION_COLORS[group] ?? OUTPUTS_SECTION_COLORS.strategy;
  const stickyTop = OUTPUTS_SECTION_NAV_HEIGHT + sectionIndex * OUTPUTS_GROUP_LABEL_STEP;

  return (
    <button
      type="button"
      onClick={onJump}
      style={{ borderLeftColor: borderColor, top: stickyTop }}
      className={cn(OUTPUTS_CLASSES.groupLabel, className)}
    >
      {Icon ? (
        <span className="g-icon">
          <Icon aria-hidden />
        </span>
      ) : null}
      {label}
      <span className="g-count">
        {count} output{count === 1 ? "" : "s"}
      </span>
      <span className="g-jump">
        <ArrowRightIcon aria-hidden />
        Jump here
      </span>
    </button>
  );
}
