import Link from "next/link";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";

import { QUOTATIONS_LIST_PATH } from "@/features/quotations/constants";

type QuotationBreadcrumbsProps = {
  serial: string | null;
};

export function QuotationBreadcrumbs({ serial }: QuotationBreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2 text-[12px] md:px-6"
    >
      <Link
        href={QUOTATIONS_LIST_PATH}
        className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeftIcon className="size-3.5" />
        Client Quotations
      </Link>
      <ChevronRightIcon className="size-3 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Discovery</span>
      <ChevronRightIcon className="size-3 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Client Quotations</span>
      <ChevronRightIcon className="size-3 text-muted-foreground" aria-hidden />
      <span className="font-semibold text-foreground">{serial ?? "QT-PENDING"}</span>
    </nav>
  );
}
