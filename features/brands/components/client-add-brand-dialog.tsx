"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { createBrandAction, type FormActionState } from "@/features/brands/actions";
import {
  CLIENT_FORM_FIELD_LABEL_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  ClientProfileTabSaveButton,
} from "@/features/clients/components/client-form-ui";
import { checkBrandNameAvailable } from "@/features/validation/actions";
import { brandVrInheritanceHint } from "@/lib/clients/vr-inheritance";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientDetail } from "@/types/database";

type ClientAddBrandDialogProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId?: string;
};

export function ClientAddBrandDialog({
  client,
  masterData,
  open,
  onOpenChange,
  formId = "client-add-brand-form",
}: ClientAddBrandDialogProps) {
  const router = useRouter();
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const clientVrRateId = client.vr_rate_id ?? null;

  const [brandName, setBrandName] = useState("");
  const [vrRateId, setVrRateId] = useState(clientVrRateId ?? "");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);

  const brandHasOverride = Boolean(vrRateId) && vrRateId !== (clientVrRateId ?? "");
  const vrHint = brandVrInheritanceHint(client.vr_rate_percent, brandHasOverride);

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    brandName,
    checkBrandNameAvailable,
    [client.id],
    open
  );

  const [state, formAction, isPending] = useActionState(createBrandAction, {
    ok: false,
  } satisfies FormActionState);

  const resetForm = () => {
    setBrandName("");
    setVrRateId(clientVrRateId ?? "");
    setCurrency(DEFAULT_PLATFORM_CURRENCY);
  };

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      resetForm();
      onOpenChange(false);
      router.refresh();
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange, router]);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, client.id, clientVrRateId]);

  const submitDisabled = isPending || isDuplicate || checking;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add new brand</DialogTitle>
          <DialogDescription>
            Commercial brand profile for {client.name}. VR% inherits from the legal entity
            overview unless overridden.
          </DialogDescription>
        </DialogHeader>
        {!state.ok && state.message ? (
          <p className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {state.message}
          </p>
        ) : null}
        <form id={formId} action={formAction} className="grid gap-4">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="vr_rate_id" value={vrRateId} />
          <input type="hidden" name="currency_code" value={currency} />

          <div className="grid gap-2">
            <Label htmlFor="client_add_brand_name" className={CLIENT_FORM_FIELD_LABEL_CLASS}>
              Brand name
            </Label>
            <Input
              id="client_add_brand_name"
              name="name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className={CLIENT_FORM_INPUT_CLASS}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
            {duplicateMessage ? (
              <p className="text-xs text-destructive">{duplicateMessage}</p>
            ) : checking ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              After saving, open the brand to upload a logo.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className={CLIENT_FORM_FIELD_LABEL_CLASS}>VR%</Label>
              <SearchableSelect
                value={vrRateId}
                onValueChange={setVrRateId}
                options={masterData.vrRates.map((v) => ({
                  value: v.id,
                  label: v.name,
                }))}
                disabled={isPending}
                placeholder="Select VR rate"
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <p className="text-[11.5px] leading-relaxed text-[#9099A8]">{vrHint}</p>
            </div>
            <div className="grid gap-2">
              <Label className={CLIENT_FORM_FIELD_LABEL_CLASS}>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className={CLIENT_FORM_SELECT_TRIGGER_CLASS}>
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

          <DialogFooter>
            <ClientProfileTabSaveButton
              formId={formId}
              label="Create brand"
              pendingLabel="Creating…"
              isPending={isPending}
              disabled={submitDisabled}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
