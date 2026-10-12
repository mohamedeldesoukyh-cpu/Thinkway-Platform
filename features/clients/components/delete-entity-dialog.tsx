import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { deleteEntityAction } from "../entity-management-actions";
export function DeleteEntityDialog({ kind, id, name, open, onOpenChange }: {
  kind: "brand" | "client"; id: string; name: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function close() { setConfirmation(""); setError(""); onOpenChange(false); }
  return <Dialog open={open} onOpenChange={(value) => { if (!pending) { setConfirmation(""); setError(""); onOpenChange(value); } }}>
    <DialogContent><DialogHeader><DialogTitle>Delete {kind}</DialogTitle>
      <DialogDescription>Delete {name} permanently? Campaigns, brands, quotations, invoices and other linked records block deletion. Reassign or remove those records through their own workflows first; issued documents are preserved.</DialogDescription>
    </DialogHeader>
    <Label htmlFor={"delete-" + id}>Type {name} to confirm</Label>
    <Input id={"delete-" + id} value={confirmation} disabled={pending} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={pending} onClick={close}>Cancel</Button>
      <Button variant="destructive" disabled={pending || confirmation !== name} onClick={() => startTransition(async () => {
        try {
          const result = await deleteEntityAction({ kind, id, confirmation });
          if (!result.ok) { setError(result.message ?? "Deletion failed."); return; }
          toast.success(result.message); close();
          if (kind === "client") router.push("/clients"); else router.refresh();
        } catch { setError("Deletion could not be confirmed. Refresh before trying again."); }
      })}>{pending ? "Checking…" : "Delete " + kind}</Button>
    </DialogFooter></DialogContent>
  </Dialog>;
}
