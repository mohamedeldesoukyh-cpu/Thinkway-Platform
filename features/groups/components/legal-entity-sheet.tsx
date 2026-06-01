"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClientAction } from "@/features/clients/actions";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  labelForOption,
} from "@/features/clients/constants";
import {
  updateGroupLegalEntityAction,
  type FormActionState,
} from "@/features/groups/actions";
import { checkClientNameAvailable } from "@/features/validation/actions";
import type { GroupLegalEntityRow } from "@/features/groups/types";
import type { AgencyOrDirect, ClientStatus, PaymentTerms } from "@/types/database";

type LegalEntitySheetProps = {
  groupId: string;
  entity: GroupLegalEntityRow | null;
  currencyOptions: { value: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LegalEntitySheet({
  groupId,
  entity,
  currencyOptions,
  open,
  onOpenChange,
}: LegalEntitySheetProps) {
  const isEdit = entity !== null;
  const [status, setStatus] = useState<ClientStatus>(entity?.status ?? "active");
  const [entityName, setEntityName] = useState(entity?.name ?? "");
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect>(
    entity?.agency_or_direct ?? "agency"
  );
  const [country, setCountry] = useState(entity?.country ?? "");
  const [currency, setCurrency] = useState(entity?.currency ?? "USD");
  const [paymentTerms, setPaymentTerms] = useState(entity?.payment_terms ?? "");

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    entityName,
    checkClientNameAvailable,
    isEdit && entity
      ? [agencyOrDirect, entity.id]
      : [agencyOrDirect],
    open && Boolean(agencyOrDirect)
  );

  const [createState, createAction, createPending] = useActionState(
    createClientAction,
    { ok: false }
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateGroupLegalEntityAction,
    { ok: false } satisfies FormActionState
  );

  const state = isEdit ? updateState : createState;
  const formAction = isEdit ? updateAction : createAction;
  const isPending = isEdit ? updatePending : createPending;

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (open) {
      setStatus(entity?.status ?? "active");
      setEntityName(entity?.name ?? "");
      setAgencyOrDirect(entity?.agency_or_direct ?? "agency");
      setCountry(entity?.country ?? "");
      setCurrency(entity?.currency ?? "USD");
      setPaymentTerms(entity?.payment_terms ?? "");
    }
  }, [open, entity]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Edit legal entity" : "Create legal entity"}
          </SheetTitle>
          <SheetDescription>
            Legal entities under this group for contracts, billing, and campaigns.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          {isEdit ? (
            <>
              <input type="hidden" name="client_id" value={entity.id} />
              <input type="hidden" name="group_id" value={groupId} />
            </>
          ) : (
            <input type="hidden" name="group_id" value={groupId} />
          )}
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
          <input type="hidden" name="country" value={country} />
          <input type="hidden" name="currency" value={currency} />
          {!isEdit ? null : (
            <input type="hidden" name="payment_terms" value={paymentTerms} />
          )}

          <div className="grid gap-2">
            <Label htmlFor="le_name">Legal entity name</Label>
            <Input
              id="le_name"
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
            <Label htmlFor="le_legal_name">Legal name</Label>
            <Input
              id="le_legal_name"
              name="legal_name"
              defaultValue={entity?.legal_name ?? ""}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Country</Label>
              <SearchableSelect
                value={country}
                onValueChange={setCountry}
                options={COUNTRY_OPTIONS}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={setCurrency}
                disabled={isPending}
              >
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

          {isEdit ? (
            <div className="grid gap-2">
              <Label>Payment terms</Label>
              <Select
                value={paymentTerms}
                onValueChange={(v) => setPaymentTerms(v as PaymentTerms)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select terms" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ClientStatus)}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={isPending || isDuplicate || checking}>
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save legal entity"
                  : "Create legal entity"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function paymentTermsLabel(terms: PaymentTerms | null): string {
  if (!terms) {
    return "—";
  }
  return labelForOption(PAYMENT_TERMS_OPTIONS, terms);
}
