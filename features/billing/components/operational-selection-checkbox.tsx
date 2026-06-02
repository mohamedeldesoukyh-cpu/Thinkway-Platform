"use client";

import { useEffect, useRef } from "react";

import type { RowSelectionStatus } from "@/lib/billing/operational-selection";

type OperationalSelectionCheckboxProps = {
  status: RowSelectionStatus;
  disabled?: boolean;
  onToggle: () => void;
  ariaLabel?: string;
};

export function OperationalSelectionCheckbox({
  status,
  disabled,
  onToggle,
  ariaLabel,
}: OperationalSelectionCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = status === "indeterminate";
    }
  }, [status]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 rounded border-border"
      checked={status === "checked"}
      disabled={disabled}
      onChange={onToggle}
      aria-label={ariaLabel}
    />
  );
}
