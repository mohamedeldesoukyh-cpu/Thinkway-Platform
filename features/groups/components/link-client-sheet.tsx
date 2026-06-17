"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  linkClientToGroupAction,
  type FormActionState,
} from "@/features/groups/actions";

type LinkClientSheetProps = {
  groupId: string;
  unlinkedClients: { id: string; name: string; legal_name: string | null }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LinkClientSheet({
  groupId,
  unlinkedClients,
  open,
  onOpenChange,
}: LinkClientSheetProps) {
  const [clientId, setClientId] = useState(unlinkedClients[0]?.id ?? "");
  const [state, formAction, isPending] = useActionState(linkClientToGroupAction, {
    ok: false,
  } satisfies FormActionState);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (open) {
      setClientId(unlinkedClients[0]?.id ?? "");
    }
  }, [open, unlinkedClients]);

  const clientOptions = unlinkedClients.map((client) => ({
    value: client.id,
    label: client.legal_name ? `${client.name} (${client.legal_name})` : client.name,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Link client</SheetTitle>
          <SheetDescription>
            Attach an existing client to this holding group. Create new clients from the
            Clients page if needed.
          </SheetDescription>
        </SheetHeader>
        {unlinkedClients.length === 0 ? (
          <div className="space-y-3 px-6 pb-6 text-sm text-muted-foreground">
            <p>No unlinked clients available. All clients are already assigned to a group.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/clients">Create a client</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="client_id" value={clientId} />

            <div className="grid gap-2">
              <Label>Client</Label>
              <SearchableSelect
                value={clientId}
                onValueChange={setClientId}
                options={clientOptions}
                disabled={isPending}
                placeholder="Select client"
              />
              <FieldError messages={state.fieldErrors?.client_id} />
            </div>

            <SheetFooter className="px-0">
              <Button type="submit" disabled={isPending || !clientId}>
                {isPending ? "Linking…" : "Link client"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
