"use client";

import { SHOW_ORIGINAL_CURRENCY_LABEL } from "../quotation-client-facing";

export function OriginalCurrencyToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="orig-toggle">
      <span>{SHOW_ORIGINAL_CURRENCY_LABEL}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={SHOW_ORIGINAL_CURRENCY_LABEL}
        className={checked ? "orig-switch on" : "orig-switch"}
        onClick={() => onChange(!checked)}
      >
        <span className="orig-knob" />
      </button>
    </label>
  );
}
