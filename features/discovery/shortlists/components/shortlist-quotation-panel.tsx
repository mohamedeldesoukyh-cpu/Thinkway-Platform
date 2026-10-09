
import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuotationListStatusPill } from "@/features/quotations/components/quotation-list-status-pill";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationStatus } from "@/types/database";
import { cn } from "@/lib/utils";

import type { ShortlistLinkedQuotation } from "../types";
import type { ShortlistCreatorItem } from "../types";

const ISSUED_STATUSES = new Set<QuotationStatus>([
  "sent",
  "approved",
  "accepted",
]);

function formatDisplayVersion(versionNumber: number): string {
  return `v${versionNumber}`;
}

/** Pack status pill — Draft → `.tw-p p-n` (HTML pgShortlist). */
function PackStatusPill({ status }: { status: QuotationStatus }) {
  if (status === "draft") {
    return <span className="tw-p p-n">Draft</span>;
  }
  return <QuotationListStatusPill status={status} />;
}

type Props = {
  quotations: ShortlistLinkedQuotation[];
  onGenerateNewVersion: (quotation?: ShortlistLinkedQuotation) => void;
  creators?: ShortlistCreatorItem[];
  busy?: boolean;
  /** When true, render compact action buttons only (creators toolbar). */
  actionsOnly?: boolean;
};

/**
 * Spec §02 / discovery.html `pgShortlist` quotation strip:
 * `.tw-c > .tw-ch` — Quotation linked · serial · count · version · Draft · Open · Generate
 */
export function ShortlistQuotationPanel({
  quotations,
  onGenerateNewVersion,
  busy,
  actionsOnly,
  creators = [],
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (quotations.length === 0) return null;

  const latest = quotations.find(q => q.id === selectedId) ?? quotations[0];
  const issued = ISSUED_STATUSES.has(latest.status);
  const multiple = quotations.length > 1;
  const detailHref = quotationDetailPath(latest.id, latest.serial_number);
  const displayVersion = formatDisplayVersion(latest.version_number);
  const title = issued ? "Quotation issued" : "Quotation linked";

  const openButton = multiple && actionsOnly ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="tw-b sm pri" disabled={busy}>
          Open quotation
          <ChevronDownIcon className="size-3 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Linked quotations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quotations.map((q) => (
          <DropdownMenuItem key={q.id} asChild>
            <Link
              href={quotationDetailPath(q.id, q.serial_number)}
              className="flex cursor-pointer items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate font-mono text-xs">
                {q.serial_number ?? q.name}
              </span>
              <QuotationListStatusPill status={q.status} />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Link
      href={detailHref}
      className={cn("tw-b sm pri", busy && "pointer-events-none opacity-50")}
      aria-disabled={busy || undefined}
    >
      Open quotation
    </Link>
  );

  const actionButtons = (
    <>
      {openButton}
      <button
        type="button"
        className="tw-b sm"
        onClick={() => onGenerateNewVersion(latest)}
        disabled={busy}
      >
        Generate new version
      </button>
    </>
  );

  if (actionsOnly) {
    return <div className="flex flex-wrap items-center gap-1.5">{actionButtons}</div>;
  }

  return (
    <div className="q-card sl-linked-card" style={{ marginBottom: 11 }}>
        <div className="sl-link">
          <span className="sl-link__k">{title}</span>
          {latest.serial_number ? (
            <Link href={detailHref} className="ref" style={{ color: "var(--tw-bi)" }}>
              {latest.serial_number}
            </Link>
          ) : null}
          <span className="sl-link__n">
            {displayVersion} · {creators.filter(c => c.quotation_refs.some(q => q.quotation_id === latest.id)).length} of {creators.length} creators linked
          </span>
          <PackStatusPill status={latest.status} />
          <span className="tw-sp" />
          {multiple && <select className="q-sel sl-linked-select" aria-label="Linked quotations" value={latest.id} onChange={event => setSelectedId(event.target.value)}>{quotations.map(q => <option key={q.id} value={q.id}>{q.serial_number ?? q.name} · v{q.version_number} · {q.status.replaceAll("_", " ")}</option>)}</select>}
          {actionButtons}
        </div>
    </div>
  );
}

export function ShortlistQuotationActions(props: Props) {
  return <ShortlistQuotationPanel {...props} actionsOnly />;
}
