"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  parseQuotationTermsText,
  type QuotationTermSection,
} from "@/features/quotations/quotation-default-terms";
import { cn } from "@/lib/utils";

type Props = {
  termsText: string | null | undefined;
  className?: string;
  variant?: "default" | "flush";
};

function TermItem({
  index,
  section,
  defaultOpen,
  variant,
}: {
  index: number;
  section: QuotationTermSection;
  defaultOpen?: boolean;
  variant: "default" | "flush";
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const flush = variant === "flush";

  if (flush) {
    return (
      <div className="acc-item">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span>
            <span className="n">{index + 1}</span>
            {section.title}
          </span>
          <ChevronDownIcon
            className={cn("car size-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {open ? (
          <div className="pb-3 pl-6 text-[12.5px] leading-relaxed text-[var(--text-3)]">
            {section.body}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="thinkway-campaign-term-item">
      <button
        type="button"
        className="thinkway-campaign-term-head w-full text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span>
          {index + 1} — {section.title}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-[var(--camp-text-3)] transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="thinkway-campaign-term-body">{section.body}</div> : null}
    </div>
  );
}

export function QuotationTermsAccordion({
  termsText,
  className,
  variant = "flush",
}: Props) {
  const sections = parseQuotationTermsText(termsText);

  return (
    <div className={cn("space-y-0", className)}>
      {sections.map((section, index) => (
        <TermItem
          key={section.title}
          index={index}
          section={section}
          variant={variant}
        />
      ))}
    </div>
  );
}
