"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  convertQuotationToCampaign,
  previewConvertQuotationToCampaign,
} from "@/features/quotations/lifecycle-actions";
import type { QuotationDetail } from "@/features/quotations/types";

type PreviewResult = Awaited<ReturnType<typeof previewConvertQuotationToCampaign>>;
type PreviewData = NonNullable<Extract<PreviewResult, { ok: true }>["data"]>;

type Props = {
  detail: QuotationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemIds?: string[];
};

export function ConvertQuotationDialog({ detail, open, onOpenChange, itemIds }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
      return;
    }

    startTransition(async () => {
      const res = await previewConvertQuotationToCampaign({
        quotationId: detail.id,
        itemIds,
      });
      if (!res.ok) {
        setError(res.message || "Failed to preview conversion.");
        setPreview(null);
        return;
      }
      if (!res.data) {
        setError("Failed to preview conversion.");
        setPreview(null);
        return;
      }
      setError(null);
      setPreview(res.data);
    });
  }, [open, detail.id, itemIds]);

  function execute() {
    startTransition(async () => {
      const res = await convertQuotationToCampaign({
        quotationId: detail.id,
        itemIds,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (!res.data) {
        toast.error("Conversion failed.");
        return;
      }
      toast.success(res.message ?? "Converted to campaign");
      if (res.data.warnings?.length) {
        toast.message("Conversion warnings", {
          description: res.data.warnings.slice(0, 3).join(" · "),
        });
      }
      onOpenChange(false);
      router.push(`/campaigns/${res.data.campaignId}`);
      router.refresh();
    });
  }

  const alreadyExists = Boolean(preview?.alreadyExists);
  const assignments = preview?.preview?.assignments ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert to Campaign</DialogTitle>
          <DialogDescription>
            Creates operational Assignments from {itemIds?.length ? "the selected creators on" : ""} this
            approved quotation. The quotation remains the commercial baseline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Accepted quotation</Badge>
            <span className="font-mono text-xs">
              {detail.serial_number ?? detail.id.slice(0, 8)}
            </span>
            <Badge variant="outline">V{detail.version_number}</Badge>
            <Badge variant="outline">{detail.status}</Badge>
          </div>

          {pending && !preview && !error ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Analysing quotation…
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {preview?.preview ? (
            <>
              {alreadyExists ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  A campaign with Assignments already exists for this quotation. Conversion
                  is idempotent and will not create duplicates.{" "}
                  {preview.campaignId ? (
                    <Link
                      href={`/campaigns/${preview.campaignId}`}
                      className="font-medium underline"
                    >
                      Open {preview.documentNumber || "campaign"}
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Will be copied
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {preview.preview.copied.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Remains on quotation
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                    {preview.preview.remainsOnQuotation.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Dry-run preview
                  </p>
                  <Badge variant="outline">
                    Header → {preview.preview.headerStatus}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.preview.packageCount} package · {preview.preview.itemCount}{" "}
                  item · {preview.skippedAlternatives} alternative(s) skipped
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                  {assignments.map((row) => (
                    <li
                      key={row.primaryItemId}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                    >
                      <span>
                        <Badge variant="outline" className="mr-1.5 text-[10px]">
                          {row.kind}
                        </Badge>
                        {row.name}
                        <span className="ml-1 text-muted-foreground">
                          · {row.deliverableCount} deliv. · {row.memberCount} creator(s)
                        </span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {row.revenue.toLocaleString()} / {row.cost.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
                {preview.snapshotHash ? (
                  <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
                    Snapshot {preview.snapshotHash.slice(0, 16)}…
                  </p>
                ) : null}
              </div>

              {preview.warnings.length > 0 ? (
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs font-semibold">Warnings</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {preview.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={pending || !preview || alreadyExists || Boolean(error)}
            onClick={execute}
          >
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Convert to Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
