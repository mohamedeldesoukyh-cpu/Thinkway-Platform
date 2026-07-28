"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  detectCampaignBackfillEligibility,
  executeCampaignAssignmentBackfill,
  previewCampaignAssignmentBackfill,
} from "@/features/campaigns/actions/backfill-assignments-actions";

type Step = "detect" | "preview" | "execute" | "summary";

type Detection = {
  eligible: boolean;
  campaignId: string;
  documentNumber: string;
  quotationId: string | null;
  quotationSerial: string | null;
  quotationStatus: string | null;
  lineCount: number;
  vendorLinkCount: number;
  vendorIoCount: number;
  invoiceLinkCount: number;
  reason: string;
  warnings: string[];
};

type Props = {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BackfillAssignmentsWizard({ campaignId, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("detect");
  const [detection, setDetection] = useState<Detection | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState<{
    linesCreated: number;
    documentNumber: string;
    warnings: string[];
    snapshotHash?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("detect");
      setDetection(null);
      setPreview(null);
      setSummary(null);
      setError(null);
      return;
    }

    startTransition(async () => {
      const res = await detectCampaignBackfillEligibility(campaignId);
      if (!res.ok) {
        setError(res.message || "Detection failed.");
        return;
      }
      if (!res.data) {
        setError("Detection failed.");
        return;
      }
      setDetection(res.data as Detection);
      setStep("detect");
    });
  }, [open, campaignId]);

  function runPreview() {
    startTransition(async () => {
      const res = await previewCampaignAssignmentBackfill(campaignId);
      if (!res.ok) {
        setError(res.message || "Preview failed.");
        return;
      }
      if (!res.data) {
        setError("Preview failed.");
        return;
      }
      setPreview(res.data);
      setError(null);
      setStep("preview");
    });
  }

  function runExecute() {
    startTransition(async () => {
      setStep("execute");
      const res = await executeCampaignAssignmentBackfill(campaignId);
      if (!res.ok) {
        setError(res.message || "Backfill failed.");
        setStep("preview");
        return;
      }
      if (!res.data) {
        setError("Backfill failed.");
        setStep("preview");
        return;
      }
      setSummary({
        linesCreated: res.data.linesCreated,
        documentNumber: res.data.documentNumber,
        warnings: res.data.warnings,
        snapshotHash: res.data.snapshotHash,
      });
      setStep("summary");
      toast.success(res.message ?? "Backfill complete");
      router.refresh();
    });
  }

  const previewAssignments =
    (
      preview?.preview as
        | { assignments?: Array<{ name: string; kind: string; revenue: number }> }
        | undefined
    )?.assignments ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Backfill Assignments</DialogTitle>
          <DialogDescription>
            Detect → Analyse → Preview → Execute. Never automatic. Fully audited.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {(["detect", "preview", "execute", "summary"] as const).map((key) => (
            <Badge key={key} variant={step === key ? "default" : "outline"}>
              {key}
            </Badge>
          ))}
        </div>

        <div className="space-y-3 text-sm">
          {pending && !detection ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Detecting legacy campaign shape…
            </div>
          ) : null}

          {error ? <p className="text-destructive">{error}</p> : null}

          {detection && step === "detect" ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="font-medium">{detection.reason}</p>
              <ul className="text-xs text-muted-foreground">
                <li>Campaign: {detection.documentNumber || campaignId.slice(0, 8)}</li>
                <li>
                  Quotation: {detection.quotationSerial ?? "—"} ({detection.quotationStatus ?? "—"})
                </li>
                <li>Assignments: {detection.lineCount}</li>
                <li>Vendor links: {detection.vendorLinkCount}</li>
                <li>Vendor IO links: {detection.vendorIoCount}</li>
                <li>Invoice links: {detection.invoiceLinkCount}</li>
              </ul>
              {detection.warnings.length > 0 ? (
                <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-300">
                  {detection.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {step === "preview" && preview ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preview
              </p>
              <p className="text-xs text-muted-foreground">
                Would create {String(preview.linesCreated ?? 0)} Assignment(s). Dry-run —
                no data written.
              </p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
                {previewAssignments.map((row, index) => (
                  <li key={`${row.name}-${index}`} className="rounded bg-muted/40 px-2 py-1">
                    {row.kind}: {row.name} · {row.revenue.toLocaleString()}
                  </li>
                ))}
              </ul>
              {Array.isArray(preview.warnings) && (preview.warnings as string[]).length > 0 ? (
                <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-300">
                  {(preview.warnings as string[]).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {step === "execute" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Executing backfill…
            </div>
          ) : null}

          {step === "summary" && summary ? (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="font-medium">Backfill complete</p>
              <p className="text-xs text-muted-foreground">
                Created {summary.linesCreated} Assignment(s) on{" "}
                {summary.documentNumber || "campaign"}.
              </p>
              {summary.snapshotHash ? (
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  Snapshot {summary.snapshotHash.slice(0, 16)}…
                </p>
              ) : null}
              {summary.warnings.length > 0 ? (
                <ul className="list-disc pl-4 text-xs">
                  {summary.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {step === "summary" ? "Close" : "Cancel"}
          </Button>
          {step === "detect" && detection?.eligible ? (
            <Button disabled={pending} onClick={runPreview}>
              Analyse / Preview
            </Button>
          ) : null}
          {step === "preview" ? (
            <Button disabled={pending} onClick={runExecute}>
              Execute backfill
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
