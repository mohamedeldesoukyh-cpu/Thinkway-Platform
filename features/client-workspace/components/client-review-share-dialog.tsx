"use client";

import { useState } from "react";
import { AlertTriangleIcon, CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ClientReviewShareDialog({
  open,
  onOpenChange,
  url,
  reviewNumber,
  status,
  version,
  documentLabel,
  linkEnabled = Boolean(url),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  reviewNumber?: number;
  status?: string | null;
  version?: string | number | null;
  documentLabel?: string | null;
  linkEnabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const title = reviewNumber != null ? `Client review v${reviewNumber}` : "Client review link";

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Review link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Select it and copy manually.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCopied(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {linkEnabled
              ? "Share this signed link with the client, or open it to check the proposal. The URL stays the same when the quotation changes. Use Send to Client to email it."
              : "This client link is off. Its URL is retained so it can be reactivated without issuing a replacement."}
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
          role="status"
          aria-live="polite"
        >
          <span
            className={`size-2 shrink-0 rounded-full ${
              linkEnabled ? "bg-emerald-500" : "bg-slate-400"
            }`}
            aria-hidden
          />
          <span className="font-semibold">{linkEnabled ? "Client link live" : "Client link off"}</span>
        </div>
        {status || version != null || documentLabel ? (
          <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-background">
            <div className="min-w-0 px-3 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Status</dt>
              <dd className="mt-0.5 truncate text-xs font-semibold capitalize">
                {status?.replaceAll("_", " ") || (linkEnabled ? "Live" : "Off")}
              </dd>
            </div>
            <div className="min-w-0 px-3 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Version</dt>
              <dd className="mt-0.5 truncate text-xs font-semibold">
                {version != null ? String(version) : reviewNumber != null ? `v${reviewNumber}` : "—"}
              </dd>
            </div>
            <div className="min-w-0 px-3 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Document</dt>
              <dd className="mt-0.5 truncate text-xs font-semibold">{documentLabel || "—"}</dd>
            </div>
          </dl>
        ) : null}
        {!linkEnabled ? (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              This URL currently shows nothing to the client. Revoking a link means toggling it off;
              it does not issue a new URL.
            </p>
          </div>
        ) : null}
        {url ? (
          <div className="flex gap-2">
            <Input
              readOnly
              value={url}
              aria-label="Client review link"
              className="font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="button" variant="outline" onClick={() => void copyLink()} aria-label="Copy link">
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              Copy
            </Button>
          </div>
        ) : null}
        <DialogFooter>
          {url ? (
            <Button type="button" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-4" />
                Open review
              </a>
            </Button>
          ) : null}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
