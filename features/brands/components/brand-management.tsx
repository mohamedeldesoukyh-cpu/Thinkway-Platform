import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DeleteEntityDialog } from "@/features/clients/components/delete-entity-dialog";
import { moveBrandClientAction } from "@/features/clients/entity-management-actions";
export type BrandClientOption = { id: string; name: string; document_number: string };
export function BrandManagement({ brand, clients }: { brand: { id: string; name: string; client_id: string; client_name: string }; clients: BrandClientOption[] }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="flex items-center gap-2">
    <Button size="sm" variant="outline" onClick={() => { setClientId(""); setError(""); setMoveOpen(true); }}>Change client</Button>
    <Button size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>Delete brand</Button>
    <Dialog open={moveOpen} onOpenChange={(v) => { if (!pending) setMoveOpen(v); }}><DialogContent>
      <DialogHeader><DialogTitle>Change client for {brand.name}</DialogTitle>
        <DialogDescription>Current client: {brand.client_name}. Only brands with no linked records can be moved here. Campaigns and financial history are never moved automatically.</DialogDescription></DialogHeader>
      <SearchableSelect value={clientId} onValueChange={setClientId} disabled={pending} placeholder="Select new client" options={clients.filter((c) => c.id !== brand.client_id).map((c) => ({value: c.id, label: c.name + " · " + c.document_number}))} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setMoveOpen(false)}>Cancel</Button>
        <Button disabled={pending || !clientId} onClick={() => startTransition(async () => {
          try {
            const result = await moveBrandClientAction({ id: brand.id, previousClientId: brand.client_id, clientId });
            if (!result.ok) { setError(result.message ?? "Change failed."); return; }
            toast.success(result.message); setMoveOpen(false); router.refresh();
          } catch { setError("The change could not be confirmed. Refresh before trying again."); }
        })}>{pending ? "Checking…" : "Confirm client change"}</Button>
      </DialogFooter>
    </DialogContent></Dialog>
    <DeleteEntityDialog kind="brand" id={brand.id} name={brand.name} open={deleteOpen} onOpenChange={setDeleteOpen} />
  </div>;
}
