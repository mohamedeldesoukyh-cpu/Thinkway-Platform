"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { appendQuotationCreatorToCampaign, listQuotationCampaignTargets } from "@/features/quotations/lifecycle-actions";

type Result = Awaited<ReturnType<typeof appendQuotationCreatorToCampaign>>;
type Targets = Extract<Awaited<ReturnType<typeof listQuotationCampaignTargets>>, { ok: true }>["campaigns"];

export function AppendQuotationCreatorDialog({ quotationId, itemId, linkedCampaignId, onClose }: {
  quotationId: string; itemId: string; linkedCampaignId?: string | null; onClose: () => void;
}) {
  const router = useRouter();
  const [targets, setTargets] = useState<Targets>([]);
  const [campaignId, setCampaignId] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let cancelled = false;
    void listQuotationCampaignTargets(quotationId).then(response => {
      if (cancelled) return;
      if (!response.ok) { setLoadError(response.message); return; }
      setTargets(response.campaigns);
      if (!response.campaigns.length) setLoadError("No eligible campaigns for this client and brand.");
      if (response.campaigns.some(c => c.id === linkedCampaignId)) setCampaignId(linkedCampaignId!);
    }).catch(() => { if (!cancelled) setLoadError("Could not load campaigns. Close and try again."); });
    return () => { cancelled = true; };
  }, [quotationId, linkedCampaignId]);

  function run(dryRun: boolean) {
    startTransition(async () => {
      try {
        const response = await appendQuotationCreatorToCampaign({ quotationId, itemId, campaignId, dryRun });
        setResult(response);
        if (!dryRun && response.ok) {
          toast.success(response.message);
          onClose();
          router.push(`/campaigns/${response.campaignId}`);
          router.refresh();
        }
      } catch { setResult({ ok: false, message: "Could not complete the request. Preview again before retrying." }); }
    });
  }
  const preview = result?.ok && !result.alreadyExists ? result.preview : null;
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add creator to existing campaign</DialogTitle>
        <DialogDescription>Add only this selected creator with its saved quotation pricing and deliverables. Existing assignments and the campaign status stay unchanged.</DialogDescription>
      </DialogHeader>
      <label htmlFor="quotation-target-campaign" className="text-sm font-medium">Campaign</label>
      <select id="quotation-target-campaign" className="min-h-11 w-full rounded-md border bg-background p-2 text-base" value={campaignId} disabled={pending} onChange={e => { setCampaignId(e.target.value); setResult(null); }}>
        <option value="">Select a campaign</option>
        {targets.map(c => <option key={c.id} value={c.id}>{c.document_number} · {c.name}</option>)}
      </select>
      {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
      {result && (!result.ok || result.alreadyExists) && <p role="alert" className="text-sm">{result.ok ? "This creator is already in the selected campaign. No duplicate will be added." : result.message}</p>}
      {preview && <div className="rounded-md border p-3 text-sm">
        {preview.assignments.map(a => <div key={a.primaryItemId} className="space-y-1 break-words">
          <p className="font-semibold">{a.name}</p>
          <p>{a.deliverableCount} deliverable(s) · Revenue {a.currencyCode} {a.revenue.toLocaleString()} · Cost {a.currencyCode} {a.cost.toLocaleString()} · Agency fee {a.afPct}%</p>
        </div>)}
        <p className="mt-2 text-muted-foreground">Only the selected creator will be added.</p>
      </div>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button disabled={pending || !campaignId || !!loadError || !!(result?.ok && result.alreadyExists)} onClick={() => run(!preview)}>
          {pending ? "Working…" : preview ? "Add creator" : "Preview addition"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
