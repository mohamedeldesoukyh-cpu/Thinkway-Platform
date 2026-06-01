"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  createCampaignAction,
  type CreateCampaignFormState,
} from "@/features/campaigns/actions";
import {
  CAMPAIGN_STATUS_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import type { CampaignFormOptions } from "@/features/campaigns/queries";
import type { BrandFormOption } from "@/features/campaigns/types";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { labelForOption } from "@/lib/master-data/constants";
import { AGENCY_OR_DIRECT_OPTIONS } from "@/features/clients/constants";

const initialState: CreateCampaignFormState = { ok: false };
const NONE_VALUE = "__none__";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

type BrandOption = BrandFormOption;

type NewCampaignDialogProps = CampaignFormOptions;

export function NewCampaignDialog({
  brands,
  accountManagers,
  masterData,
}: NewCampaignDialogProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("draft");
  const [currency, setCurrency] = useState("USD");
  const [accountManagerId, setAccountManagerId] = useState(NONE_VALUE);
  const [state, formAction, isPending] = useActionState(
    createCampaignAction,
    initialState
  );

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId),
    [brands, brandId]
  );

  useEffect(() => {
    if (selectedBrand?.currency_code) {
      setCurrency(selectedBrand.currency_code);
    }
  }, [selectedBrand]);

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      setBrandId("");
      setPlatform("");
      setStatus("draft");
      setCurrency("USD");
      setAccountManagerId(NONE_VALUE);
      setOpen(false);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const brandOptions = brands.map((b) => ({
    value: b.id,
    label: `${b.name} · ${(b.client as { name: string } | null)?.name ?? "Client"}`,
  }));

  const hasBrands = brands.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!hasBrands} title={!hasBrands ? "Create a brand before creating campaigns." : undefined}>
          <PlusIcon data-icon="inline-start" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,800px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Select a brand to auto-fill hierarchy and commercial terms. Header
            and line A are created together.
          </DialogDescription>
        </DialogHeader>
        {!hasBrands ? (
          <p className="text-sm text-muted-foreground">
            Create a brand before creating campaigns.
          </p>
        ) : (
          <form action={formAction} className="grid gap-4">
            <input type="hidden" name="brand_id" value={brandId} />
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="currency_code" value={currency} />
            <input
              type="hidden"
              name="account_manager_id"
              value={accountManagerId === NONE_VALUE ? "" : accountManagerId}
            />

            <div className="grid gap-2">
              <Label>Brand</Label>
              <SearchableSelect
                value={brandId}
                onValueChange={setBrandId}
                options={brandOptions}
                disabled={isPending}
                placeholder="Select brand"
              />
              <FieldError messages={state.fieldErrors?.brand_id} />
            </div>

            {selectedBrand ? (
              <div className="grid gap-3 rounded-3xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <ReadonlyField
                  label="Group"
                  value={(selectedBrand.group as { name: string } | null)?.name}
                />
                <ReadonlyField
                  label="Legal entity"
                  value={(selectedBrand.client as { legal_name: string | null; name: string } | null)?.legal_name ??
                    (selectedBrand.client as { name: string } | null)?.name}
                />
                <ReadonlyField
                  label="Category"
                  value={(selectedBrand.category as { name: string } | null)?.name}
                />
                <ReadonlyField
                  label="Subcategory"
                  value={(selectedBrand.subcategory as { name: string } | null)?.name}
                />
                <ReadonlyField
                  label="Agency / Direct"
                  value={labelForOption(
                    AGENCY_OR_DIRECT_OPTIONS,
                    selectedBrand.client?.agency_or_direct
                  )}
                />
                <ReadonlyField
                  label="VR%"
                  value={
                    selectedBrand.vr_rate
                      ? `${(selectedBrand.vr_rate as { rate_percent: number }).rate_percent}%`
                      : "—"
                  }
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Campaign name</Label>
                <Input id="name" name="name" required disabled={isPending} />
                <FieldError messages={state.fieldErrors?.name} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="line_name">Line A name (optional)</Label>
                <Input id="line_name" name="line_name" disabled={isPending} />
              </div>
              <div className="grid gap-2">
                <Label>Platform</Label>
                <Select
                  value={platform || NONE_VALUE}
                  onValueChange={(v) => setPlatform(v === NONE_VALUE ? "" : v)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
                    {PLATFORM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="po_amount">PO amount</Label>
                <Input
                  id="po_amount"
                  name="po_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.po_amount} />
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
              <div className="grid gap-2">
                <Label htmlFor="fx_rate">FX rate (to USD)</Label>
                <Input
                  id="fx_rate"
                  name="fx_rate"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  defaultValue="1"
                  disabled={isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="start_date">Start date</Label>
                <Input id="start_date" name="start_date" type="date" disabled={isPending} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date">End date</Label>
                <Input id="end_date" name="end_date" type="date" disabled={isPending} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Account manager</Label>
                <Select
                  value={accountManagerId}
                  onValueChange={setAccountManagerId}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Assign account manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
                    {accountManagers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !brandId}>
                {isPending ? "Creating…" : "Create campaign"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadonlyField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value || "—"}</p>
    </div>
  );
}
