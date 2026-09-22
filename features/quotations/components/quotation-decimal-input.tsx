"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";

import { Input } from "@/components/ui/input";
import {
  formatNumDisplay,
  mergePastedNumericText,
  parseDecimalInput,
} from "@/lib/quotations/quotation-numeric-input";

function displayDecimalText(value: number, blankWhenZero: boolean, precision?: number): string {
  if (blankWhenZero && value === 0) return "";
  return precision == null ? formatNumDisplay(value) : value.toLocaleString("en-US", { maximumFractionDigits: precision });
}

/** Focus/blur money input — grouped thousands when idle, raw typing while focused. */
export function QuotationDecimalInput({
  value,
  onCommit,
  precision,
  isValid,
  blankWhenZero = false,
  placeholder = "0",
  ...props
}: {
  value: number;
  onCommit: (next: number) => void;
  blankWhenZero?: boolean;
  precision?: number;
  isValid?: (value: number) => boolean;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(() => displayDecimalText(value, blankWhenZero, precision));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(displayDecimalText(value, blankWhenZero, precision));
  }, [value, blankWhenZero, precision]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onFocus={(event) => {
        focusedRef.current = true;
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = parseDecimalInput(next);
        if (!isValid || isValid(parsed)) onCommit(parsed);
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        const parsed = parseDecimalInput(text);
        const valid = !isValid || isValid(parsed);
        if (valid) onCommit(parsed);
        setText(displayDecimalText(valid ? parsed : value, blankWhenZero, precision));
        props.onBlur?.(event);
      }}
      onPaste={(event) => {
        event.stopPropagation();
        event.preventDefault();
        const target = event.currentTarget;
        const merged = mergePastedNumericText(
          text,
          event.clipboardData.getData("text"),
          target.selectionStart,
          target.selectionEnd
        );
        setText(merged);
        const parsed = parseDecimalInput(merged);
        if (!isValid || isValid(parsed)) onCommit(parsed);
        props.onPaste?.(event);
      }}
    />
  );
}
