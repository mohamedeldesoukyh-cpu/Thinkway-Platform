"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { recordAdLiveDateAction } from "@/features/campaigns/actions/assignment-deliverable-actions";

export function RecordLiveDateButton({ campaignId, scheduleId, liveDate, label }: {
  campaignId: string; scheduleId: string; liveDate: string | null; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(liveDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <>
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]"
      onClick={() => { setDate(liveDate ?? ""); setError(null); setOpen(true); }}>Went live date</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Record actual live date</DialogTitle>
          <DialogDescription>{label}. Confirm when this creator package went live. All deliverables will be tagged Went live and use this date until their own actual publication date is recorded.</DialogDescription>
        </DialogHeader>
        <form onSubmit={event => { event.preventDefault(); startTransition(async () => {
          try {
            const result = await recordAdLiveDateAction({ campaignId, scheduleId, liveDate: date });
            if (!result.ok) { setError(result.message ?? "Could not save the live date."); return; }
            toast.success(result.message); setOpen(false); router.refresh();
          } catch { setError("Could not save the live date. Your date is still here; try again."); }
        }); }} className="space-y-4">
          <label className="block space-y-2 text-sm">Actual live date
            <Input aria-label="Actual live date" type="date" value={date} required
              max={new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })}
              onChange={event => setDate(event.target.value)} disabled={pending}/>
          </label>
          <p className="text-xs text-muted-foreground">Saving recognizes the full creator line and matching cost. Actual Performance publication dates take priority.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={!date || pending}>{pending ? "Saving..." : "Confirm package live"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
