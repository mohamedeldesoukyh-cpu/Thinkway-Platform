"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
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
import {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  CURRENCY_OPTIONS,
} from "@/features/clients/constants";
import type { GroupBrandRow, GroupLegalEntityRow } from "@/features/groups/types";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { AgencyOrDirect, ClientStatus } from "@/types/database";

type BrandSheetProps = {
  legalEntities: GroupLegalEntityRow[];
  masterData: MasterDataOptions;
  brand: GroupBrandRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BrandSheet({
  legalEntities,
  masterData,
  brand,
  open,
  onOpenChange,
}: BrandSheetProps) {
  const isEdit = brand !== null;
  const defaultClientId =
    legalEntities.find((le) => le.name === brand?.client_name)?.id ??
    legalEntities[0]?.id ??
    "";

  const [clientId, setClientId] = useState(defaultClientId);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect | "">("");
  const [vrRateId, setVrRateId] = useState("");
  const [currency, setCurrency] = useState(brand?.currency_code ?? "USD");
  const [status, setStatus] = useState<ClientStatus>(brand?.status ?? "active");

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
    if (!open) {
      return;
    }
    setClientId(defaultClientId);
    setCurrency(brand?.currency_code ?? "USD");
    setStatus(brand?.status ?? "active");
    setAgencyOrDirect(brand?.agency_or_direct ?? "");

    if (brand?.category_name) {
      const category = masterData.categories.find(
        (c) => c.name === brand.category_name
      );
      setCategoryId(category?.id ?? "");
      if (brand.subcategory_name && category) {
        const sub = masterData.subcategories.find(
          (s) =>
            s.category_id === category.id && s.name === brand.subcategory_name
        );
        setSubcategoryId(sub?.id ?? "");
      } else {
        setSubcategoryId("");
      }
    } else {
      setCategoryId("");
      setSubcategoryId("");
    }

    if (brand?.vr_rate_percent != null) {
      const vr = masterData.vrRates.find(
        (v) => v.rate_percent === brand.vr_rate_percent
      );
      setVrRateId(vr?.id ?? "");
    } else {
      setVrRateId("");
    }
  }, [open, brand, defaultClientId, masterData]);

  const subcategories = masterData.subcategories.filter(
    (s) => !categoryId || s.category_id === categoryId
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit brand" : "Create brand"}</SheetTitle>
          <SheetDescription>
            Commercial brand profile for campaigns under this group.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-1 flex-col gap-4 px-6 pb-6">
          {isEdit ? <input type="hidden" name="brand_id" value={brand.id} /> : null}
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="category_id" value={categoryId} />
          <input type="hidden" name="subcategory_id" value={subcategoryId} />
          <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
          <input type="hidden" name="vr_rate_id" value={vrRateId} />
          <input type="hidden" name="currency_code" value={currency} />
          {isEdit ? <input type="hidden" name="status" value={status} /> : null}

          <div className="grid gap-2">
            <Label htmlFor="brand_name">Brand name</Label>
            <Input
              id="brand_name"
              name="name"
              defaultValue={brand?.name ?? ""}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
          </div>

          <div className="grid gap-2">
            <Label>Legal entity</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={isPending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select legal entity" />
              </SelectTrigger>
              <SelectContent>
                {legalEntities.map((le) => (
                  <SelectItem key={le.id} value={le.id}>
                    {le.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={categoryId}
                onValueChange={(v) => {
                  setCategoryId(v);
                  setSubcategoryId("");
                }}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {masterData.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Subcategory</Label>
              <Select
                value={subcategoryId}
                onValueChange={setSubcategoryId}
                disabled={isPending || !categoryId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Agency / Direct</Label>
              <Select
                value={agencyOrDirect}
                onValueChange={(v) => setAgencyOrDirect(v as AgencyOrDirect)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
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
              <Label>VR%</Label>
              <Select value={vrRateId} onValueChange={setVrRateId} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {masterData.vrRates.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
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
            <Button type="submit" disabled={isPending || !clientId}>
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
