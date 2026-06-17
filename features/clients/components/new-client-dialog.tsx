"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createClientAction,
  type CreateClientFormState,
} from "@/features/clients/actions";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  COUNTRY_OPTIONS,
} from "@/features/clients/constants";
import { checkClientNameAvailable } from "@/features/validation/actions";
import type { AgencyOrDirect } from "@/types/database";

const initialState: CreateClientFormState = { ok: false };

type NewClientDialogProps = {
  groups: { id: string; name: string }[];
  currencyOptions: { value: string; label: string }[];
};

export function NewClientDialog({ groups, currencyOptions }: NewClientDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect>("agency");
  const [status, setStatus] = useState("prospect");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);
  const [country, setCountry] = useState("");

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    entityName,
    checkClientNameAvailable,
    [agencyOrDirect],
    open && Boolean(agencyOrDirect)
  );
  const [state, formAction, isPending] = useActionState(
    createClientAction,
    initialState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      setGroupId("");
      setEntityName("");
      setStatus("prospect");
      setCurrency(DEFAULT_PLATFORM_CURRENCY);
      setCountry("");
      setOpen(false);
      if (state.clientId) {
        router.push(`/clients/${state.clientId}`);
      }
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-4">
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Add a client legal entity. Optionally link to a holding group now or
            assign one later from the client profile.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="country" value={country} />

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-2">
            <Label>Holding group (optional)</Label>
            <SearchableSelect
              value={groupId}
              onValueChange={setGroupId}
              options={groupOptions}
              disabled={isPending}
              placeholder={groups.length > 0 ? "Link to group (optional)" : "No groups yet"}
            />
            <FieldError messages={state.fieldErrors?.group_id} />
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                You can create a client without a group and link one later.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Client legal name</Label>
            <Input
              id="name"
              name="name"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              required
              disabled={isPending}
              placeholder="Registered legal entity name"
            />
            <FieldError messages={state.fieldErrors?.name} />
            {duplicateMessage ? (
              <p className="text-xs text-destructive">{duplicateMessage}</p>
            ) : checking ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Relationship type</Label>
            <Select
              value={agencyOrDirect}
              onValueChange={(v) => setAgencyOrDirect(v as AgencyOrDirect)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENCY_OR_DIRECT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Country</Label>
              <SearchableSelect
                value={country}
                onValueChange={setCountry}
                options={COUNTRY_OPTIONS}
                disabled={isPending}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} disabled={isPending} />
          </div>

          <p className="text-xs text-muted-foreground">
            Client IO terms use the platform default. Customize them from the client
            profile after creation.
          </p>
          </div>

          <DialogFooter className="shrink-0 border-t border-border/40 px-6 py-4">
            <Button
              type="submit"
              disabled={isPending || isDuplicate || checking}
            >
              {isPending ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
