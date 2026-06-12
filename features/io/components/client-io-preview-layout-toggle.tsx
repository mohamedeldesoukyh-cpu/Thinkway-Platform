"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { ClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";

type ClientIoPreviewLayoutToggleProps = {
  clientIoId: string;
  activeLayout: ClientIoDocumentLayout;
};

const OPTIONS: Array<{ id: ClientIoDocumentLayout; label: string; hint: string }> = [
  {
    id: "detailed",
    label: "Detailed",
    hint: "Per assignment",
  },
  {
    id: "package",
    label: "Package",
    hint: "Campaign total",
  },
];

export function ClientIoPreviewLayoutToggle({
  clientIoId,
  activeLayout,
}: ClientIoPreviewLayoutToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = pathname ?? `/ios/client/${clientIoId}/preview`;

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 print:hidden"
      role="tablist"
      aria-label="Client IO layout"
    >
      {OPTIONS.map((option) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("layout", option.id);
        const href = `${basePath}?${params.toString()}`;
        const active = activeLayout === option.id;

        return (
          <Link
            key={option.id}
            href={href}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            <span className="ml-1.5 hidden text-[10px] font-normal text-muted-foreground sm:inline">
              · {option.hint}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
