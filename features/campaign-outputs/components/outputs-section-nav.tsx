"use client";

import { ListIcon, ZapIcon, CalendarIcon, UserIcon, ColumnsIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignOutputGroup } from "../output-types";
import { OUTPUTS_CLASSES } from "../constants/outputs-center-tokens";

const SECTION_ICONS: Record<CampaignOutputGroup, LucideIcon> = {
  strategy: ZapIcon,
  planning: CalendarIcon,
  client: UserIcon,
  internal: ColumnsIcon,
};

export type OutputsSectionNavProps = {
  sections: Array<{ group: CampaignOutputGroup; label: string; count: number }>;
  activeGroup: CampaignOutputGroup | null;
  onJump: (group: CampaignOutputGroup) => void;
  className?: string;
};

/**
 * Sticky section jump bar — highlights the group currently in view.
 */
export function OutputsSectionNav({
  sections,
  activeGroup,
  onJump,
  className,
}: OutputsSectionNavProps) {
  return (
    <div className={cn(OUTPUTS_CLASSES.sectionNav, className)}>
      <div className="flex w-full items-center gap-2">
        <span className="oc-snav-jump">
          <ListIcon aria-hidden />
          Sections
        </span>
        <div className="flex items-center gap-2">
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.group];
            const active = activeGroup === section.group;
            return (
              <button
                key={section.group}
                type="button"
                onClick={() => onJump(section.group)}
                className={cn(OUTPUTS_CLASSES.snavPill, active && OUTPUTS_CLASSES.snavPillActive)}
              >
                <Icon aria-hidden />
                {section.label}
                <span className="oc-snav-count">{section.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
