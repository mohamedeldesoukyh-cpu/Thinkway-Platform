import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  DISCOVERY_SECTION_DESC_CLASS,
  DISCOVERY_SECTION_HEADER_CLASS,
  DISCOVERY_SECTION_TITLE_CLASS,
} from "./discovery-design-tokens";

type DiscoverySectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** In-card section header (Import upload/history, list modules). */
export function DiscoverySectionHeader({
  title,
  description,
  action,
  className,
}: DiscoverySectionHeaderProps) {
  return (
    <div
      className={cn(
        DISCOVERY_SECTION_HEADER_CLASS,
        action && "flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <div>
        <h2 className={DISCOVERY_SECTION_TITLE_CLASS}>{title}</h2>
        {description ? <p className={DISCOVERY_SECTION_DESC_CLASS}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
