"use client";

import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { sanitizeAssignmentCreatorName } from "@/lib/campaigns/assignment-line-naming";
import { cn } from "@/lib/utils";

type AssignmentCreatorCellProps = {
  name: string;
  avatarUrl?: string | null;
  onClick?: () => void;
  className?: string;
};

/** Creator column — profile photo + wrapping name (thinkway-campaign_2.html asgn-table). */
export function AssignmentCreatorCell({
  name,
  avatarUrl,
  onClick,
  className,
}: AssignmentCreatorCellProps) {
  const displayName = sanitizeAssignmentCreatorName(name, name);

  const inner = (
    <>
      <CreatorThumbAvatar name={displayName} avatarUrl={avatarUrl} size={18} />
      <span className="min-w-0 whitespace-normal break-words text-[11px] font-medium leading-tight text-[var(--camp-text)]">
        {displayName}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-w-0 items-start gap-1.5 text-left transition-colors hover:text-primary",
          className
        )}
        title={`View ${displayName} details`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-start gap-1.5", className)}>{inner}</div>
  );
}
