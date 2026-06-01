"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
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
  CLIENT_STATUS_OPTIONS,
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
  const [currency, setCurrency] = useState("USD");
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
      setStatus("prospect");
      setCurrency("USD");
      setCountry("");
      setOpen(false);
      if (state.clientId) {
        router.push(`/clients/${state.clientId}`);
      }
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  const hasGroups = groups.length > 0;
  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasGroups}>
          <PlusIcon data-icon="inline-start" />
          New Legal Entity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New legal entity</DialogTitle>
          <DialogDescription>
            Add a client legal entity under a group. Add brands on the profile
            page.
          </DialogDescription>
        </DialogHeader>
        {!hasGroups ? (
          <p className="text-sm text-muted-foreground">
            Create a group first, then add legal entities.
          </p>
        ) : (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
            <input type="hidden" name="currency" value={currency} />
            <input type="hidden" name="country" value={country} />

            <div className="grid gap-2">
              <Label>Group</Label>
              <SearchableSelect
                value={groupId}
                onValueChange={setGroupId}
                options={groupOptions}
                disabled={isPending}
                placeholder="Select group"
              />
              <FieldError messages={state.fieldErrors?.group_id} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Entity name</Label>
              <Input
                id="name"
                name="name"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                required
                disabled={isPending}
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

            <div className="grid gap-2">
              <Label htmlFor="legal_name">Legal name</Label>
              <Input id="legal_name" name="legal_name" disabled={isPending} />
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

            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending || !groupId || isDuplicate || checking}
              >
                {isPending ? "Creating…" : "Create entity"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
