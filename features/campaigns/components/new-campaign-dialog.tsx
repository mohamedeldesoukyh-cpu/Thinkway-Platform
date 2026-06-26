"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CreditLimitExceededDialog } from "@/features/campaigns/components/credit-limit-exceeded-dialog";
import { CampaignCommercialSummaryCard } from "@/features/campaigns/components/campaign-commercial-summary-card";
import {
  CAMPAIGN_STATUS_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import type { CampaignFormOptions } from "@/features/campaigns/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { resolveCommercialCategoryLabels } from "@/lib/master-data/commercial-category-labels";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { labelForOption } from "@/lib/master-data/constants";
import { AGENCY_OR_DIRECT_OPTIONS } from "@/features/clients/constants";
import {
  buildClientSelectOptions,
  dedupeClientsById,
} from "@/lib/clients/client-select-options";
import {
  buildGroupFilterSelectOptions,
  isIndependentGroupFilter,
  matchesGroupFilter,
} from "@/lib/groups/group-filter";
import { formatGroupDisplayName } from "@/lib/groups/group-display";

const initialState: CreateCampaignFormState = { ok: false };
const NONE_VALUE = "__none__";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

type NewCampaignDialogProps = CampaignFormOptions;

export function NewCampaignDialog({
  groups,
  clients,
  brands,
  accountManagers,
  masterData,
}: NewCampaignDialogProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [clientId, setClientId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("draft");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);
  const [accountManagerId, setAccountManagerId] = useState(NONE_VALUE);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const acceptRiskRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(
    createCampaignAction,
    initialState
  );

  const uniqueClients = useMemo(() => dedupeClientsById(clients), [clients]);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId),
    [brands, brandId]
  );

  const selectedClient = useMemo(
    () => uniqueClients.find((c) => c.id === clientId),
    [uniqueClients, clientId]
  );

  const resolvedClientTaxonomy = useMemo(() => {
    const clientCategorySlug =
      selectedClient?.client_category ??
      selectedBrand?.client?.client_category ??
      null;
    const clientSubcategorySlug =
      selectedClient?.client_subcategory ??
      selectedBrand?.client?.client_subcategory ??
      null;

    return { clientCategorySlug, clientSubcategorySlug };
  }, [selectedBrand, selectedClient]);

  const commercialLabels = useMemo(() => {
    if (!selectedBrand && !selectedClient) {
      return null;
    }

    return resolveCommercialCategoryLabels({
      brandCategoryName: selectedBrand?.category?.name,
      brandSubcategoryName: selectedBrand?.subcategory?.name,
      clientCategorySlug: resolvedClientTaxonomy.clientCategorySlug,
      clientSubcategorySlug: resolvedClientTaxonomy.clientSubcategorySlug,
    });
  }, [selectedBrand, selectedClient, resolvedClientTaxonomy]);

  const commercialGroupName = useMemo(() => {
    if (selectedBrand?.group) {
      return (selectedBrand.group as { name: string }).name;
    }
    if (selectedClient?.group_id) {
      return groups.find((group) => group.id === selectedClient.group_id)?.name ?? null;
    }
    if (selectedBrand || selectedClient) {
      return formatGroupDisplayName(null);
    }
    return null;
  }, [groups, selectedBrand, selectedClient]);

  const commercialClientName = useMemo(() => {
    const brandClient = selectedBrand?.client;
    if (brandClient?.legal_name?.trim()) {
      return brandClient.legal_name;
    }
    if (brandClient?.name) {
      return brandClient.name;
    }
    if (selectedClient?.legal_name?.trim()) {
      return selectedClient.legal_name;
    }
    return selectedClient?.name ?? null;
  }, [selectedBrand, selectedClient]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !selectedClient) {
      return;
    }

    if (
      !resolvedClientTaxonomy.clientCategorySlug &&
      !resolvedClientTaxonomy.clientSubcategorySlug
    ) {
      console.warn("[new-campaign-dialog] client taxonomy missing at runtime", {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
      });
    }
  }, [resolvedClientTaxonomy, selectedClient]);

  const filteredClients = useMemo(() => {
    if (isIndependentGroupFilter(groupId)) {
      return uniqueClients.filter((c) => c.group_id == null);
    }
    if (!groupId) return uniqueClients;
    return uniqueClients.filter((c) => c.group_id === groupId);
  }, [uniqueClients, groupId]);

  const filteredBrands = useMemo(() => {
    if (clientId) return brands.filter((b) => b.client_id === clientId);
    if (isIndependentGroupFilter(groupId)) {
      return brands.filter((b) => b.group_id == null);
    }
    if (groupId) return brands.filter((b) => b.group_id === groupId);
    return brands;
  }, [brands, clientId, groupId]);

  const resetHierarchy = useCallback(() => {
    setGroupId("");
    setClientId("");
    setBrandId("");
  }, []);

  const handleGroupChange = useCallback(
    (id: string) => {
      setGroupId(id);
      if (!id) return;
      const client = uniqueClients.find((c) => c.id === clientId);
      if (client && !matchesGroupFilter(client.group_id, id)) {
        setClientId("");
        setBrandId("");
        return;
      }
      const brand = brands.find((b) => b.id === brandId);
      if (brand && !matchesGroupFilter(brand.group_id, id)) {
        setBrandId("");
      }
    },
    [brands, clientId, brandId, uniqueClients]
  );

  const handleClientChange = useCallback(
    (id: string) => {
      setClientId(id);
      if (!id) {
        setBrandId("");
        return;
      }
      const client = uniqueClients.find((c) => c.id === id);
      if (client?.group_id) {
        setGroupId(client.group_id);
      }
      const brand = brands.find((b) => b.id === brandId);
      if (!brand || brand.client_id !== id) {
        setBrandId("");
      }
    },
    [brands, brandId, uniqueClients]
  );

  const handleBrandChange = useCallback(
    (id: string) => {
      setBrandId(id);
      const brand = brands.find((b) => b.id === id);
      if (!brand) return;
      setClientId(brand.client_id);
      setGroupId(brand.group_id ?? "");
    },
    [brands]
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
      resetHierarchy();
      setPlatform("");
      setStatus("draft");
      setCurrency(DEFAULT_PLATFORM_CURRENCY);
      setAccountManagerId(NONE_VALUE);
      if (acceptRiskRef.current) {
        acceptRiskRef.current.value = "false";
      }
      setCreditDialogOpen(false);
      setOpen(false);
      return;
    }

    if (
      state.creditLimit?.exceeded &&
      state.creditLimit.can_accept_risk &&
      acceptRiskRef.current?.value !== "true"
    ) {
      setCreditDialogOpen(true);
      return;
    }

    toast.error(state.message);
  }, [state, resetHierarchy]);

  const groupOptions = buildGroupFilterSelectOptions(groups);

  const clientOptions = useMemo(
    () => buildClientSelectOptions(filteredClients),
    [filteredClients]
  );

  const brandOptions = filteredBrands.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const hasBrands = brands.length > 0;

  const handleAcceptCreditRisk = useCallback(() => {
    if (acceptRiskRef.current) {
      acceptRiskRef.current.value = "true";
    }
    formRef.current?.requestSubmit();
  }, []);

  const handleCreditDialogCancel = useCallback(() => {
    setCreditDialogOpen(false);
    if (acceptRiskRef.current) {
      acceptRiskRef.current.value = "false";
    }
  }, []);

  return (
    <>
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
            Choose client and brand — selections filter each other and
            auto-fill when you pick a brand or client. Holding group is optional.
            Only the campaign header and PO budget are created; add assignments
            from the Assignments tab.
          </DialogDescription>
        </DialogHeader>
        {!hasBrands ? (
          <p className="text-sm text-muted-foreground">
            Create a brand before creating campaigns.
          </p>
        ) : (
          <form ref={formRef} action={formAction} className="grid gap-4">
            <input type="hidden" name="brand_id" value={brandId} />
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="currency_code" value={currency} />
            <input
              ref={acceptRiskRef}
              type="hidden"
              name="accept_credit_risk_confirmed"
              defaultValue="false"
            />
            <input
              type="hidden"
              name="account_manager_id"
              value={accountManagerId === NONE_VALUE ? "" : accountManagerId}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Holding group (optional)</Label>
                <SearchableSelect
                  value={groupId}
                  onValueChange={handleGroupChange}
                  options={groupOptions}
                  disabled={isPending}
                  placeholder="All groups"
                />
              </div>
              <div className="grid gap-2">
                <Label>Client</Label>
                <SearchableSelect
                  value={clientId}
                  onValueChange={handleClientChange}
                  options={clientOptions}
                  disabled={isPending || (groupId !== "" && filteredClients.length === 0)}
                  placeholder={
                    groupId && filteredClients.length === 0
                      ? isIndependentGroupFilter(groupId)
                        ? "No independent clients"
                        : "No clients in group"
                      : "Select client"
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Brand</Label>
                <SearchableSelect
                  value={brandId}
                  onValueChange={handleBrandChange}
                  options={brandOptions}
                  disabled={isPending || filteredBrands.length === 0}
                  placeholder={
                    clientId && filteredBrands.length === 0
                      ? "No brands for client"
                      : "Select brand"
                  }
                />
                <FieldError messages={state.fieldErrors?.brand_id} />
              </div>
            </div>

            {(selectedBrand || selectedClient) && commercialLabels ? (
              <CampaignCommercialSummaryCard
                groupName={commercialGroupName}
                clientName={commercialClientName}
                category={commercialLabels.category}
                subcategory={commercialLabels.subcategory}
                agencyOrDirect={labelForOption(
                  AGENCY_OR_DIRECT_OPTIONS,
                  selectedBrand?.client?.agency_or_direct
                )}
                vrPercent={
                  selectedBrand?.vr_rate
                    ? `${(selectedBrand.vr_rate as { rate_percent: number }).rate_percent}%`
                    : "—"
                }
              />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Campaign name</Label>
                <Input id="name" name="name" required disabled={isPending} />
                <FieldError messages={state.fieldErrors?.name} />
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
      {state.creditLimit?.exceeded ? (
        <CreditLimitExceededDialog
          open={creditDialogOpen}
          onOpenChange={setCreditDialogOpen}
          creditLimit={state.creditLimit}
          onAcceptRisk={handleAcceptCreditRisk}
          onCancel={handleCreditDialogCancel}
          pending={isPending}
        />
      ) : null}
    </>
  );
}
