"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { savePlannedPostingDate } from "@/features/campaigns/actions/planned-posting-date";

export function PlannedPostingDateButton({ campaignId, deliverableId, plannedDate, disabled }: {
  campaignId: string; deliverableId: string; plannedDate: string | null; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(plannedDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <>
    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" disabled={disabled}
      onClick={() => { setDate(plannedDate ?? ""); setError(null); setOpen(true); }}>Planned date</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Planned posting date</DialogTitle><DialogDescription>Schedule this deliverable separately from its actual Went live date. Planning does not recognize revenue or cost.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); startTransition(async () => {
        const result = await savePlannedPostingDate({ campaignId, deliverableId, plannedDate: date || null });
        if (!result.ok) { setError(result.message); return; }
        toast.success(result.message); setOpen(false); router.refresh();
      }); }}>
        <label className="block space-y-2 text-sm">Planned date<Input aria-label="Planned date" type="date" value={date} onChange={event => setDate(event.target.value)} disabled={pending}/></label>
        <p className="text-xs text-muted-foreground">Shown on new or regenerated client IOs. Issued IOs keep their saved schedule. Leave blank to clear.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save planned date"}</Button></div>
      </form>
    </DialogContent></Dialog>
  </>;
}
