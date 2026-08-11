"use client";

import { resolveCreatorIdentity } from "@/lib/text/decode-html-entities";
import { cn } from "@/lib/utils";

type CreatorNameStackProps = {
  name?: string | null;
  handle?: string | null;
  className?: string;
  nameClassName?: string;
  handleClassName?: string;
  /** When true and no handle resolves, omit the secondary line. */
  hideMissingHandle?: boolean;
};

/**
 * Two-line creator identity: display name over @username (Discovery detail bar).
 */
export function CreatorNameStack({
  name,
  handle,
  className,
  nameClassName,
  handleClassName,
  hideMissingHandle = false,
}: CreatorNameStackProps) {
  const identity = resolveCreatorIdentity(name, handle);
  const handleLabel = identity.handle ? `@${identity.handle.replace(/^@+/, "")}` : null;

  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("truncate text-sm font-medium text-foreground", nameClassName)}>
        {identity.name || handleLabel || "Creator"}
      </p>
      {handleLabel ? (
        <p className={cn("truncate text-[11px] text-muted-foreground", handleClassName)}>
          {handleLabel}
        </p>
      ) : hideMissingHandle ? null : null}
    </div>
  );
}
