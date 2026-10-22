"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateQuotationHeader } from "@/features/quotations/actions";

export function RenameQuotationDialog({ id, name, disabled = false }: { id: string; name: string; disabled?: boolean }) {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, startTransition] = useTransition();
  return <Dialog open={open} onOpenChange={next => {
    if (pending) return;
    if (next) setDraft(name);
    setOpen(next);
  }}>
    <DialogTrigger asChild>
      <button type="button" className="q-b q-b--sm q-b--ghost" aria-label="Edit quotation name" title="Edit quotation name" disabled={disabled}>
        <PencilIcon className="size-4" aria-hidden />
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-lg">
      <form onSubmit={event => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed || pending) return;
        startTransition(async () => {
          try {
            const result = await updateQuotationHeader({ id, name: trimmed });
            if (!result.ok) { toast.error(result.message); return; }
            toast.success("Quotation name updated.");
            setOpen(false);
            router.refresh();
          } catch { toast.error("Could not update the quotation name. Please try again."); }
        });
      }}>
        <DialogHeader>
          <DialogTitle>Edit quotation name</DialogTitle>
          <DialogDescription>Set the name shown in the quotation list and reports.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor={inputId}>Quotation name</Label>
          <Input id={inputId} value={draft} onChange={event => setDraft(event.target.value)} disabled={pending} required autoFocus />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending || !draft.trim() || draft.trim() === name}>{pending ? "Saving…" : "Save name"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
