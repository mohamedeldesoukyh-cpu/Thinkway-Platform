"use client";

import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { cn } from "@/lib/utils";

type AssignmentCreatorCellProps = {
  name: string;
  avatarUrl?: string | null;
  onClick?: () => void;
  className?: string;
};

/** Creator column — profile photo + name (thinkway-campaign_2.html asgn-table). */
export function AssignmentCreatorCell({
  name,
  avatarUrl,
  onClick,
  className,
}: AssignmentCreatorCellProps) {
  const inner = (
    <>
      <CreatorThumbAvatar name={name} avatarUrl={avatarUrl} size={18} />
      <span className="truncate text-[11px] font-medium text-[var(--camp-text)]">{name}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-w-0 items-center gap-1 text-left transition-colors hover:text-primary",
          className
        )}
        title={`View ${name} details`}
      >
        {inner}
      </button>
    );
  }

  return <div className={cn("flex min-w-0 items-center gap-1", className)}>{inner}</div>;
}
