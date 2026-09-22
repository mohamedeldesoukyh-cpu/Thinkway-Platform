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
import { clientLinkName, clientLinkShareText } from '../link-label';
import { shareImagePath } from '../share-preview';
import { updateShareCoverAction } from '../actions/update-share-cover-action';

export function ClientReviewShareDialog({
  open,
  onOpenChange,
  url,
  reviewNumber,
  status,
  version,
  documentLabel,
  campaignName,
  linkEnabled = Boolean(url),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  reviewNumber?: number;
  status?: string | null;
  version?: string | number | null;
  documentLabel?: string | null;
  campaignName?: string | null;
  linkEnabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverVersion, setCoverVersion] = useState("1");
  let previewUrl: string | null = null;
  let reviewId = "";
  let sign = "";
  try {
    const parsed = new URL(url || "");
    reviewId = parsed.pathname.split("/")[2] || "";
    sign = parsed.searchParams.get("sign") || "";
    if (reviewId && sign) previewUrl = shareImagePath(reviewId, sign, coverVersion);
  } catch { /* No link yet. */ }

  async function changeCover(file?: File) {
    if (coverBusy) return;
    setCoverBusy(true);
    try {
      const form = new FormData();
      form.set("reviewId", reviewId);
      form.set("sign", sign);
      if (file) form.set("file", file); else form.set("remove", "true");
      const result = await updateShareCoverAction(form);
      if (result.ok) { setCoverVersion(String(Date.now())); toast.success(result.message); }
      else toast.error(result.message);
    } catch { toast.error("Could not update the cover. Please try again."); }
    finally { setCoverBusy(false); }
  }
  const title = reviewNumber != null ? `Client review v${reviewNumber}` : "Client review link";

  async function copyLink(withName = false) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(withName ? clientLinkShareText(campaignName, url) : url);
      setCopied(true);
      toast.success(withName ? 'Campaign name and link copied.' : "Review link copied.");
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {campaignName?.trim() && <p className="break-words text-base font-semibold" dir="auto">{clientLinkName(campaignName)}</p>}
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
        {previewUrl && linkEnabled && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold">Campaign link preview</summary>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Campaign link cover" className="mt-3 aspect-[1200/630] w-full rounded-lg object-cover" />
            <p className="mt-2 text-sm font-semibold">{campaignName || "Your campaign"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Automatic branded cover, or upload your own. Recommended: 1200 × 630. WhatsApp may retain older previews.</p>
            <label className="mt-3 block text-xs font-medium">Custom cover (JPG, PNG or WebP; up to 5 MB)
              <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={coverBusy} className="mt-1" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void changeCover(file);
                event.target.value = "";
              }} />
            </label>
            <Button type="button" variant="outline" size="sm" className="mt-2" disabled={coverBusy} onClick={() => void changeCover()}>
              {coverBusy ? "Updating cover…" : "Use automatic cover"}
            </Button>
          </details>
        )}
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
          {url && campaignName?.trim() && <Button type="button" onClick={() => void copyLink(true)}>Copy with campaign name</Button>}
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
