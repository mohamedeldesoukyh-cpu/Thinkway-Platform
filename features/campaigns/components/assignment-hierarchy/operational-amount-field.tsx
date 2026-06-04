"use client";

import { useCallback, useEffect, useId, useState } from "react";

import {
  formatOperationalAmount,
  parseOperationalAmountInput,
} from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { OPERATIONAL_AMOUNT_CLASS } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { cn } from "@/lib/utils";

const INPUT_CLASS = cn(
  OPERATIONAL_AMOUNT_CLASS,
  "h-auto min-h-0 w-full min-w-0 border-0 bg-transparent py-0 text-right shadow-none outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
);

type OperationalAmountFieldProps = {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
};

export function OperationalAmountField({
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
}: OperationalAmountFieldProps) {
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => formatOperationalAmount(value));

  useEffect(() => {
    if (!focused) setText(formatOperationalAmount(value));
  }, [value, focused]);

  const commitBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseOperationalAmountInput(text);
    if (parsed !== null) {
      onChange(parsed);
      setText(formatOperationalAmount(parsed));
    } else {
      setText(formatOperationalAmount(value));
    }
    onBlur?.();
  }, [onBlur, onChange, text, value]);

  if (disabled) {
    return (
      <span className={cn(OPERATIONAL_AMOUNT_CLASS, className)}>
        {formatOperationalAmount(value)}
      </span>
    );
  }

  if (!focused) {
    return (
      <button
        type="button"
        className={cn(
          OPERATIONAL_AMOUNT_CLASS,
          "w-full rounded-sm text-right hover:bg-muted/30",
          className
        )}
        onClick={() => {
          setText(formatOperationalAmount(value));
          setFocused(true);
        }}
      >
        {formatOperationalAmount(value)}
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
      onBlur={commitBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={cn(INPUT_CLASS, className)}
      autoFocus
    />
  );
}

type OperationalQtyFieldProps = {
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
};

export function OperationalQtyField({
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
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

  if (!focused) {
    return (
      <button
        type="button"
        className={cn(
          OPERATIONAL_AMOUNT_CLASS,
          "w-full rounded-sm text-right hover:bg-muted/30",
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
      className={cn(INPUT_CLASS, className)}
      autoFocus
    />
  );
}
