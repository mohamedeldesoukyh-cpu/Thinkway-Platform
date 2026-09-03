"use client";

import { CreatorThumbAvatar } from "@/components/creator/creator-thumb-cell";
import { sanitizeAssignmentCreatorName } from "@/lib/campaigns/assignment-line-naming";
import { cn } from "@/lib/utils";

type AssignmentCreatorCellProps = {
  name: string;
  avatarUrl?: string | null;
  handle?: string | null;
  onClick?: () => void;
  className?: string;
};

/** Creator column — avatar + name + handle, matching campaign-detail.html `.tw-cr`. */
export function AssignmentCreatorCell({
  name,
  avatarUrl,
  handle,
  onClick,
  className,
}: AssignmentCreatorCellProps) {
  const displayName = sanitizeAssignmentCreatorName(name, name);
  const handleLabel = handle?.replace(/^@/, "").trim();

  const inner = (
    <>
      <CreatorThumbAvatar name={displayName} avatarUrl={avatarUrl} size={26} />
      <span className="min-w-0">
        <b className="block truncate text-[12.5px] font-semibold leading-tight">{displayName}</b>
        {handleLabel ? (
          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
            @{handleLabel}
          </span>
        ) : null}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-w-0 items-center gap-2 text-left transition-colors hover:text-primary",
          className
        )}
        title={`View ${displayName} details`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>{inner}</div>
  );
}
