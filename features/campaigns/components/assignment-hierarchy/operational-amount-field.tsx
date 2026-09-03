"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import {
  formatOperationalAmount,
  formatOperationalUnitAmount,
  parseOperationalAmountInput,
} from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_AMOUNT_CLASS } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

const INPUT_CLASS = cn(
  OPERATIONAL_AMOUNT_CLASS,
  "h-auto min-h-0 w-full min-w-0 border-0 bg-transparent py-0 text-center shadow-none outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
);

type OperationalAmountFieldProps = {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  /** REV/AD & COST/AD — hide .00 on whole numbers */
  perUnit?: boolean;
  /** Always show an input (grid Edit mode) instead of click-to-edit text. */
  alwaysEditing?: boolean;
  /** Spec §7 — revenue/total blue, cost amber while Edit is on. */
  editTint?: "rev" | "cost";
};

export function OperationalAmountField({
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
  perUnit = false,
  alwaysEditing = false,
  editTint,
}: OperationalAmountFieldProps) {
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const format = useMemo(
    () => (perUnit ? formatOperationalUnitAmount : formatOperationalAmount),
    [perUnit]
  );
  const [text, setText] = useState(() => format(value));

  useEffect(() => {
    if (!focused) setText(format(value));
  }, [value, focused, format]);

  const commitBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseOperationalAmountInput(text);
    if (parsed !== null) {
      onChange(parsed);
      setText(format(parsed));
    } else {
      setText(format(value));
    }
    onBlur?.();
  }, [format, onBlur, onChange, text, value]);

  if (disabled) {
    return (
      <span className={cn(OPERATIONAL_AMOUNT_CLASS, className)}>
        {format(value)}
      </span>
    );
  }

  if (!alwaysEditing && !focused) {
    return (
      <button
        type="button"
        className={cn(
          OPERATIONAL_AMOUNT_CLASS,
          "w-full rounded-sm text-center hover:bg-muted/30",
          className
        )}
        onClick={() => {
          setText(format(value));
          setFocused(true);
        }}
      >
        {format(value)}
      </button>
    );
  }

  return (
    <input
      id={inputId}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const parsed = parseOperationalAmountInput(next);
        if (parsed !== null) onChange(parsed);
      }}
      onFocus={() => setFocused(true)}
      onBlur={commitBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={cn(
        INPUT_CLASS,
        alwaysEditing &&
          "min-h-6 rounded-sm border border-border/70 bg-background px-1 focus-visible:ring-1",
        alwaysEditing && editTint === "rev" && "tw-ed rev",
        alwaysEditing && editTint === "cost" && "tw-ed cost",
        className
      )}
      autoFocus={!alwaysEditing}
    />
  );
}

type OperationalQtyFieldProps = {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  /** Always show an input (grid Edit mode) instead of click-to-edit text. */
  alwaysEditing?: boolean;
};

export function OperationalQtyField({
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
  alwaysEditing = false,
}: OperationalQtyFieldProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (!focused) setText(String(Math.max(1, Math.floor(value) || 1)));
  }, [value, focused]);

  if (disabled) {
    return (
      <span className={cn(OPERATIONAL_AMOUNT_CLASS, className)}>
        {Math.max(1, Math.floor(value) || 1)}
      </span>
    );
  }

  if (!alwaysEditing && !focused) {
    return (
      <button
        type="button"
        className={cn(
          OPERATIONAL_AMOUNT_CLASS,
          "w-full rounded-sm text-center hover:bg-muted/30",
          className
        )}
        onClick={() => {
          setText(String(value));
          setFocused(true);
        }}
      >
        {Math.max(1, Math.floor(value) || 1)}
      </button>
    );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "");
        setText(next);
        const q = Math.max(1, parseInt(next || "1", 10) || 1);
        onChange(q);
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const q = Math.max(1, parseInt(text || "1", 10) || 1);
        onChange(q);
        setText(String(q));
        onBlur?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={cn(
        INPUT_CLASS,
        alwaysEditing &&
          "min-h-6 rounded-sm border border-border/70 bg-background px-1 focus-visible:ring-1",
        className
      )}
      autoFocus={!alwaysEditing}
      aria-label="Quantity"
    />
  );
}
