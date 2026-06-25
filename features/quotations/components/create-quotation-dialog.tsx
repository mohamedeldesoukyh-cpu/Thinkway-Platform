"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBlankQuotation } from "@/features/quotations/actions";
import { quotationDetailPath } from "@/features/quotations/constants";

export function CreateQuotationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a quotation name.");
      return;
    }
    startTransition(async () => {
      const res = await createBlankQuotation({ name: trimmed });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Quotation created.");
      setOpen(false);
      setName("");
      if (res.data?.id) router.push(quotationDetailPath(res.data.id));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="size-4" />
          New Quotation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New client quotation</DialogTitle>
          <DialogDescription>
            Create a blank quotation, then add creators and set commercials. You can
            link a client, brand, and campaign inside the workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="quotation-name">Quotation name</Label>
          <Input
            id="quotation-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramadan 2026 — Brand X"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
