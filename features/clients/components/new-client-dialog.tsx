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
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
} from "@/features/clients/constants";
import { checkClientNameAvailable } from "@/features/validation/actions";
import { ClientIoTermsEditor } from "@/features/io/components/client-io-terms-editor";
import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";
import {
  serializeTermsText,
  termsAreEqual,
  type ClientIoTerm,
} from "@/lib/io/client-io-terms";
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
  const [ioTerms, setIoTerms] = useState<ClientIoTerm[]>(CLIENT_IO_DEFAULT_TERMS);
  const [usePlatformIoTerms, setUsePlatformIoTerms] = useState(true);

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
      setIoTerms(CLIENT_IO_DEFAULT_TERMS);
      setUsePlatformIoTerms(true);
      setOpen(false);
      if (state.clientId) {
        router.push(`/clients/${state.clientId}`);
      }
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));
  const clientIoTermsPayload =
    usePlatformIoTerms || termsAreEqual(ioTerms, CLIENT_IO_DEFAULT_TERMS)
      ? ""
      : serializeTermsText(ioTerms);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Add a client legal entity. Optionally link to a holding group now or
            assign one later from the client profile.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="country" value={country} />
          <input type="hidden" name="client_io_terms_text" value={clientIoTermsPayload} />

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
            <Label htmlFor="name">Client name</Label>
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

          <div className="grid gap-2 rounded-xl border border-border/60 bg-muted/10 p-3">
            <Label>Default Client IO terms (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Fixed Section 8 terms for all Client IOs on this client. Leave as platform
              default or customize.
            </p>
            <ClientIoTermsEditor
              terms={ioTerms}
              onChange={(next) => {
                setIoTerms(next);
                setUsePlatformIoTerms(false);
              }}
              onRecover={() => {
                setIoTerms(CLIENT_IO_DEFAULT_TERMS);
                setUsePlatformIoTerms(true);
              }}
              disabled={isPending}
            />
          </div>

          <DialogFooter>
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
