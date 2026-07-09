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
};

function TermItem({
  index,
  section,
  defaultOpen,
}: {
  index: number;
  section: QuotationTermSection;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

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

export function QuotationTermsAccordion({ termsText, className }: Props) {
  const sections = parseQuotationTermsText(termsText);

  return (
    <div className={cn("space-y-0", className)}>
      {sections.map((section, index) => (
        <TermItem key={section.title} index={index} section={section} />
      ))}
    </div>
  );
}
