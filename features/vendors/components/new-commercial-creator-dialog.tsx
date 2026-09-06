"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  convertInfluencerToCommercialCrmAction,
  type FormActionState,
} from "@/features/vendors/actions";

type IdentityHit = {
  id: string;
  display_name: string;
  legal_name: string | null;
  email: string | null;
  document_number: string | null;
};

const convertInitial: FormActionState & { vendorId?: string } = { ok: false };

/** Add existing Discovery/identity creators into Commercial CRM (no duplicate identity). */
export function AddFromDiscoveryToCrmDialog({
  triggerClassName = "tw-b sm",
}: {
  triggerClassName?: string;
} = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<IdentityHit[]>([]);
  const [pendingSearch, startSearch] = useTransition();
  const [convertState, convertAction, converting] = useActionState(
    convertInfluencerToCommercialCrmAction,
    convertInitial
  );

  useEffect(() => {
    if (!convertState.ok || !convertState.vendorId) return;
    toast.success(convertState.message ?? "Added to CRM");
    setOpen(false);
    router.push(`/vendors/${convertState.vendorId}`);
    router.refresh();
  }, [convertState, router]);

  function runSearch(value: string) {
    setQ(value);
    startSearch(async () => {
      if (value.trim().length < 2) {
        setHits([]);
        return;
      }
      const res = await fetch(
        `/api/vendors/crm-import-search?q=${encodeURIComponent(value.trim())}`
      );
      if (!res.ok) {
        setHits([]);
        return;
      }
      const json = (await res.json()) as { results?: IdentityHit[] };
      setHits(json.results ?? []);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          From Discovery
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add from Discovery</DialogTitle>
          <DialogDescription>
            Search identities that are not yet in Commercial CRM. Reuses existing
            influencer rows — no duplicate creators.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="crm-import-search">Search</Label>
            <Input
              id="crm-import-search"
              value={q}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Name, email, or vendor #"
            />
          </div>
          {pendingSearch ? (
            <p className="text-xs text-muted-foreground">Searching…</p>
          ) : null}
          <ul className="max-h-64 space-y-2 overflow-auto">
            {hits.map((hit) => (
              <li
                key={hit.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{hit.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[hit.document_number, hit.email, hit.legal_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <form action={convertAction}>
                  <input type="hidden" name="influencer_id" value={hit.id} />
                  <input type="hidden" name="source" value="discovery" />
                  <Button type="submit" size="sm" disabled={converting}>
                    Add to CRM
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          {!pendingSearch && q.trim().length >= 2 && hits.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No matches. Promote or create the identity in Discovery first, then convert.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
