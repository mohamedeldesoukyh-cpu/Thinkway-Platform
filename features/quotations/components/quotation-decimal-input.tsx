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

function displayDecimalText(value: number, blankWhenZero: boolean): string {
  if (blankWhenZero && value === 0) return "";
  return formatNumDisplay(value);
}

/** Focus/blur money input — grouped thousands when idle, raw typing while focused. */
export function QuotationDecimalInput({
  value,
  onCommit,
  blankWhenZero = false,
  placeholder = "0",
  ...props
}: {
  value: number;
  onCommit: (next: number) => void;
  blankWhenZero?: boolean;
} & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(() => displayDecimalText(value, blankWhenZero));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(displayDecimalText(value, blankWhenZero));
  }, [value, blankWhenZero]);

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
        onCommit(parseDecimalInput(next));
      }}
      onBlur={(event) => {
        focusedRef.current = false;
        const parsed = parseDecimalInput(text);
        onCommit(parsed);
        setText(displayDecimalText(parsed, blankWhenZero));
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
        onCommit(parseDecimalInput(merged));
        props.onPaste?.(event);
      }}
    />
  );
}
