"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { CategorySubcategoryFields } from "@/components/forms/category-subcategory-fields";
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
import { createBrandAction, type FormActionState } from "@/features/brands/actions";
import { checkBrandNameAvailable } from "@/features/validation/actions";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import type { MasterDataOptions } from "@/lib/master-data/queries";

type NewBrandDialogProps = {
  clients: {
    id: string;
    name: string;
    legal_name: string | null;
    group_id: string | null;
    document_number: string;
    status: string;
  }[];
  masterData: MasterDataOptions;
};

export function NewBrandDialog({ clients, masterData }: NewBrandDialogProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const hasClients = clients.length > 0;
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [brandName, setBrandName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [vrRateId, setVrRateId] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    brandName,
    checkBrandNameAvailable,
    [clientId],
    open && Boolean(clientId)
  );

  const [state, formAction, isPending] = useActionState(createBrandAction, {
    ok: false,
  } satisfies FormActionState);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setBrandName("");
      setCategoryId("");
      setSubcategoryId("");
      setVrRateId("");
      setCurrency(DEFAULT_PLATFORM_CURRENCY);
      setOpen(false);
      return;
    }
    toast.error(state.message);
  }, [state]);

  useEffect(() => {
    if (!open) return;
    setClientId(clients[0]?.id ?? "");
    setBrandName("");
    setCategoryId("");
    setSubcategoryId("");
    setVrRateId("");
    setCurrency(DEFAULT_PLATFORM_CURRENCY);
  }, [open, clients]);

  const clientOptions = clients.map((client) => ({
    value: client.id,
    label: client.legal_name ? `${client.name} (${client.legal_name})` : client.name,
  }));

  const selectedClient = clients.find((client) => client.id === clientId);
  const clientNeedsGroup = selectedClient && !selectedClient.group_id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasClients}>
          <PlusIcon data-icon="inline-start" />
          New Brand
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New brand</DialogTitle>
          <DialogDescription>
            Add a commercial brand under an existing client. Category, VR%, and currency
            auto-fill campaigns when this brand is selected.
          </DialogDescription>
        </DialogHeader>
        {!hasClients ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>No clients exist yet. Create a client before adding brands.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/clients">Go to Clients</Link>
            </Button>
          </div>
        ) : (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="category_id" value={categoryId} />
            <input type="hidden" name="subcategory_id" value={subcategoryId} />
            <input type="hidden" name="vr_rate_id" value={vrRateId} />
            <input type="hidden" name="currency_code" value={currency} />

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
              {clientNeedsGroup ? (
                <p className="text-xs text-destructive">
                  This client must be linked to a holding group before you can add brands.{" "}
                  <Link href={`/clients/${clientId}`} className="underline">
                    Link from client profile
                  </Link>
                  .
                </p>
              ) : null}
            </div>

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

            <div className="grid gap-4 sm:grid-cols-2">
              <CategorySubcategoryFields
                masterData={masterData}
                categoryId={categoryId}
                subcategoryId={subcategoryId}
                onCategoryChange={setCategoryId}
                onSubcategoryChange={setSubcategoryId}
                disabled={isPending}
              />
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

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  isPending || !clientId || isDuplicate || checking || Boolean(clientNeedsGroup)
                }
              >
                {isPending ? "Creating…" : "Create brand"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
