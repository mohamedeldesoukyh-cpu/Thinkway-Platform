"use client";

import { useState } from "react";
import type { ClientIoVersionSummary } from "@/lib/domains/io/types";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, FileText, Layers, LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ClientIoViewMenuProps = {
  clientIoId: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  buttonClassName?: string;
  showChevron?: boolean;
};

export function ClientIoViewMenu({
  clientIoId,
  label = "View Client IO",
  size = "sm",
  variant = "default",
  buttonClassName,
  showChevron = true,
}: ClientIoViewMenuProps) {
  const [versions, setVersions] = useState<ClientIoVersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [versionError, setVersionError] = useState(false);
  async function loadVersions(open: boolean) {
    if (!open) return;
    setLoading(true);
    setVersionError(false);
    try {
      const response = await fetch('/api/client-ios/' + clientIoId + '/versions', { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load versions");
      setVersions(await response.json());
    } catch { setVersionError(true); }
    finally { setLoading(false); }
  }
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = encodeURIComponent(`${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`);
  const base = `/ios/client/${clientIoId}/preview`;

  return (
    <DropdownMenu onOpenChange={loadVersions}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={
            buttonClassName ??
            "thinkway-campaign-btn thinkway-campaign-btn-primary h-[38px] gap-1.5 px-[15px] text-[13px]"
          }
        >
          {label}
          {showChevron ? <ChevronDown className="size-3.5 opacity-80" aria-hidden /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>Client IO layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link target="_blank" rel="noopener noreferrer" href={`${base}?layout=detailed&returnTo=${returnTo}`} className="flex cursor-pointer items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Detailed</span>
              <span className="block text-xs text-muted-foreground">
                Pricing per assignment line
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link target="_blank" rel="noopener noreferrer" href={`${base}?layout=package&returnTo=${returnTo}`} className="flex cursor-pointer items-start gap-2">
            <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Package</span>
              <span className="block text-xs text-muted-foreground">
                Single campaign total
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href={`${base}?layout=package_main&returnTo=${returnTo}`}
            className="flex cursor-pointer items-start gap-2"
          >
            <LayoutList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Package main</span>
              <span className="block text-xs text-muted-foreground">
                Package totals with main assignment lines only
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Approved IO</DropdownMenuLabel>
        {loading ? <p className="px-2 py-2 text-xs text-muted-foreground">Loading versions…</p> : versionError ? (
          <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void loadVersions(true); }}>Unable to load versions · Retry</DropdownMenuItem>
        ) : versions.length === 0 ? <p className="px-2 py-2 text-xs text-muted-foreground">No saved versions available.</p> : versions.map((version) => (
          <DropdownMenuItem key={version.id} asChild>
            <Link target="_blank" rel="noopener noreferrer" href={'/ios/client/' + version.id + '/preview?saved=1&returnTo=' + returnTo} className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{formatDocumentNumberForDisplay(version.document_number ?? "Client IO")} · Version {version.revision_number + 1}</span>
                <span className="block text-xs text-muted-foreground">{version.approved_at ? 'Approved ' + new Date(version.approved_at).toLocaleDateString() : version.status.replaceAll("_", " ")}{version.is_superseded ? " · superseded" : ""}</span>
              </span>
              {version.approved_at || version.status === "approved" ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Approved</span> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
