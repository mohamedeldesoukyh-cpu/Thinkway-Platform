"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { createBrandAction, updateBrandAction } from "@/features/brands/actions";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import type { GroupBrandRow, GroupLegalEntityRow } from "@/features/groups/types";
import { checkBrandNameAvailable } from "@/features/validation/actions";
import { brandVrInheritanceHint } from "@/lib/clients/vr-inheritance";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientStatus } from "@/types/database";

type BrandSheetProps = {
  legalEntities: GroupLegalEntityRow[];
  masterData: MasterDataOptions;
  brand: GroupBrandRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function resolveBrandFormVrRateId(
  brand: GroupBrandRow | null,
  clientVrRateId: string | null | undefined
): string {
  if (brand?.vr_rate_id) {
    return brand.vr_rate_id;
  }
  return clientVrRateId ?? "";
}

export function BrandSheet({
  legalEntities,
  masterData,
  brand,
  open,
  onOpenChange,
}: BrandSheetProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const isEdit = brand !== null;
  const defaultClientId = brand?.client_id ?? legalEntities[0]?.id ?? "";

  const [clientId, setClientId] = useState(defaultClientId);
  const [brandName, setBrandName] = useState(brand?.name ?? "");
  const [vrRateId, setVrRateId] = useState("");
  const [currency, setCurrency] = useState(
    brand?.currency_code ?? DEFAULT_PLATFORM_CURRENCY
  );
  const [status, setStatus] = useState<ClientStatus>(brand?.status ?? "active");

  const selectedClient = useMemo(
    () => legalEntities.find((entity) => entity.id === clientId),
    [legalEntities, clientId]
  );
  const clientVrRateId = selectedClient?.vr_rate_id ?? null;
  const brandHasOverride = Boolean(vrRateId) && vrRateId !== (clientVrRateId ?? "");
  const vrHint = brandVrInheritanceHint(
    selectedClient?.vr_rate_percent ?? null,
    brandHasOverride
  );

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    brandName,
    checkBrandNameAvailable,
    isEdit && brand ? [clientId, brand.id] : [clientId],
    open && Boolean(clientId)
  );

  const [createState, createAction, createPending] = useActionState(
    createBrandAction,
    { ok: false }
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateBrandAction,
    { ok: false }
  );

  const state = isEdit ? updateState : createState;
  const formAction = isEdit ? updateAction : createAction;
  const isPending = isEdit ? updatePending : createPending;
  const submitDisabled = isPending || !clientId || isDuplicate || checking;

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
    if (!open) return;
    const nextClientId = brand?.client_id ?? legalEntities[0]?.id ?? "";
    const nextClient = legalEntities.find((entity) => entity.id === nextClientId);
    setClientId(nextClientId);
    setBrandName(brand?.name ?? "");
    setVrRateId(resolveBrandFormVrRateId(brand, nextClient?.vr_rate_id));
    setCurrency(brand?.currency_code ?? DEFAULT_PLATFORM_CURRENCY);
    setStatus(brand?.status ?? "active");
  }, [open, brand, legalEntities]);

  useEffect(() => {
    if (!open || isEdit) return;
    setVrRateId(clientVrRateId ?? "");
  }, [open, isEdit, clientVrRateId]);

  const clientOptions = legalEntities.map((le) => ({
    value: le.id,
    label: le.name,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit brand" : "Create brand"}</SheetTitle>
          <SheetDescription>
            Commercial brand profile — VR% and currency. Category lives on the legal entity overview.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          {isEdit ? <input type="hidden" name="brand_id" value={brand.id} /> : null}
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="vr_rate_id" value={vrRateId} />
          <input type="hidden" name="currency_code" value={currency} />
          {isEdit ? <input type="hidden" name="status" value={status} /> : null}

          <div className="grid gap-2">
            <Label htmlFor="brand_name">Brand name</Label>
            <Input
              id="brand_name"
              name="name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
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
            <Label>Legal entity</Label>
            <SearchableSelect
              value={clientId}
              onValueChange={setClientId}
              options={clientOptions}
              disabled={isPending}
              placeholder="Select legal entity"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>VR%</Label>
              <SearchableSelect
                value={vrRateId}
                onValueChange={setVrRateId}
                options={masterData.vrRates.map((v) => ({
                  value: v.id,
                  label: v.name,
                }))}
                disabled={isPending}
                placeholder="Select VR rate"
              />
              <p className="text-xs text-muted-foreground">{vrHint}</p>
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
            {isEdit ? (
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
            ) : null}
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={submitDisabled}>
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save brand"
                  : "Create brand"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
