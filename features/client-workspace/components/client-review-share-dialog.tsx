"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  reviewNumber?: number;
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
      open={open && Boolean(url)}
      onOpenChange={(next) => {
        if (!next) setCopied(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Share this signed link with the client, or open it to check the proposal. The URL stays the
            same when the quotation changes. Use Send to Client to email it.
          </DialogDescription>
        </DialogHeader>
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
