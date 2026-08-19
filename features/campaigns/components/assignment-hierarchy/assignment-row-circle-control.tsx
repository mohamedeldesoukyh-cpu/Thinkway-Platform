"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AssignmentRowCircleControlProps = {
  kind: "add" | "remove";
  onClick: () => void;
  disabled?: boolean;
  label: string;
  className?: string;
};

/** Green + / red − circles for adding or removing assignment child rows. */
export function AssignmentRowCircleControl({
  kind,
  onClick,
  disabled = false,
  label,
  className,
}: AssignmentRowCircleControlProps) {
  const Icon = kind === "add" ? PlusIcon : MinusIcon;
  return (
    <button
      type="button"
      className={cn(
        "thinkway-campaign-row-circle",
        kind === "add"
          ? "thinkway-campaign-row-circle-add"
          : "thinkway-campaign-row-circle-remove",
        className
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Icon className="size-3" strokeWidth={2.5} aria-hidden />
    </button>
  );
}
