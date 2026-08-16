"use client";

import { cn } from "@/lib/utils";

type ChipOption = {
  value: string;
  label: string;
};

type IntakeOptionChipsProps = {
  options: readonly ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
};

export function IntakeOptionChips({
  options,
  selected,
  onChange,
  ariaLabel,
}: IntakeOptionChipsProps) {
  const selectedSet = new Set(selected.map((item) => item.trim().toLowerCase()));

  function toggle(value: string) {
    const key = value.trim().toLowerCase();
    if (selectedSet.has(key)) {
      onChange(selected.filter((item) => item.trim().toLowerCase() !== key));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = selectedSet.has(option.value.trim().toLowerCase());
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              active
                ? "border-[#0057FF] bg-[#0057FF] text-white"
                : "border-border bg-background text-foreground hover:border-[#0057FF]/50"
            )}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
