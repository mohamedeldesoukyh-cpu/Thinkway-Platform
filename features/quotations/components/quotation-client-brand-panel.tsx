"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateQuotationHeader } from "@/features/quotations/actions";
import { useQuotationManualSave } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationDetail, QuotationFormOptions } from "@/features/quotations/types";
import { clientBrandPendingDiffersFromDetail } from "@/lib/quotations/quotation-client-brand-pending-diff";

type WizardBinding = {
  useTemporary: boolean;
  tempClient: string;
  tempBrand: string;
  onUseTemporaryChange: (value: boolean) => void;
  onTempClientChange: (value: string) => void;
  onTempBrandChange: (value: string) => void;
};

type Props = {
  detail: QuotationDetail;
  options: QuotationFormOptions;
  disabled?: boolean;
  wizard?: WizardBinding;
};

export function QuotationClientBrandPanel({ detail, options, disabled, wizard }: Props) {
  const router = useRouter();
  const manualSave = useQuotationManualSave();
  const [pending, startTransition] = useTransition();
  const [localTemporary, setLocalTemporary] = useState(
    detail.is_temporary_client || detail.is_temporary_brand
  );
  const [localTempClient, setLocalTempClient] = useState(detail.temporary_client_name ?? "");
  const [localTempBrand, setLocalTempBrand] = useState(detail.temporary_brand_name ?? "");
  const [localClientId, setLocalClientId] = useState(detail.client_id ?? "");
  const [localBrandId, setLocalBrandId] = useState(detail.brand_id ?? "");
  const [localCampaignId, setLocalCampaignId] = useState(detail.campaign_header_id ?? "");

  const useTemporary = wizard?.useTemporary ?? localTemporary;
  const tempClient = wizard?.tempClient ?? localTempClient;
  const tempBrand = wizard?.tempBrand ?? localTempBrand;

  useEffect(() => {
    setLocalTemporary(detail.is_temporary_client || detail.is_temporary_brand);
    setLocalTempClient(detail.temporary_client_name ?? "");
    setLocalTempBrand(detail.temporary_brand_name ?? "");
    setLocalClientId(detail.client_id ?? "");
    setLocalBrandId(detail.brand_id ?? "");
    setLocalCampaignId(detail.campaign_header_id ?? "");
  }, [
    detail.id,
    detail.is_temporary_client,
    detail.is_temporary_brand,
    detail.temporary_client_name,
    detail.temporary_brand_name,
    detail.client_id,
    detail.brand_id,
    detail.campaign_header_id,
  ]);

  const buildPendingPayload = useCallback(
    (overrides?: {
      useTemporary?: boolean;
      tempClient?: string;
      tempBrand?: string;
      clientId?: string;
      brandId?: string;
      campaignId?: string;
    }) => {
      const nextUseTemporary = overrides?.useTemporary ?? useTemporary;
      if (nextUseTemporary) {
        return {
          useTemporary: true as const,
          temporary_client_name: overrides?.tempClient ?? tempClient,
          temporary_brand_name: overrides?.tempBrand ?? tempBrand,
        };
      }
      return {
        useTemporary: false as const,
        client_id: (overrides?.clientId ?? localClientId) || detail.client_id || null,
        brand_id: (overrides?.brandId ?? localBrandId) || detail.brand_id || null,
        campaign_header_id:
          overrides?.campaignId !== undefined
            ? overrides.campaignId || null
            : localCampaignId || detail.campaign_header_id || null,
      };
    },
    [
      detail.brand_id,
      detail.campaign_header_id,
      detail.client_id,
      localBrandId,
      localCampaignId,
      localClientId,
      tempBrand,
      tempClient,
      useTemporary,
    ]
  );

  const syncManualSave = useCallback(
    (overrides?: Parameters<typeof buildPendingPayload>[0]) => {
      if (wizard) return;
      const payload = buildPendingPayload(overrides);
      if (clientBrandPendingDiffersFromDetail(detail, payload)) {
        manualSave.registerClientBrandPending(payload);
      } else {
        manualSave.registerClientBrandPending(null);
      }
    },
    [buildPendingPayload, detail, manualSave, wizard]
  );

  function setUseTemporary(value: boolean) {
    if (wizard) wizard.onUseTemporaryChange(value);
    else {
      setLocalTemporary(value);
      syncManualSave({ useTemporary: value });
    }
  }

  function setTempClient(value: string) {
    if (wizard) wizard.onTempClientChange(value);
    else {
      setLocalTempClient(value);
      syncManualSave({ tempClient: value });
    }
  }

  function setTempBrand(value: string) {
    if (wizard) wizard.onTempBrandChange(value);
    else {
      setLocalTempBrand(value);
      syncManualSave({ tempBrand: value });
    }
  }

  const activeClientId = wizard ? detail.client_id : localClientId || detail.client_id;
  const activeBrandId = wizard ? detail.brand_id : localBrandId || detail.brand_id;
  const activeCampaignId = wizard
    ? detail.campaign_header_id
    : localCampaignId || detail.campaign_header_id;

  const clientOptions = useMemo(
    () =>
      options.clients.map((c) => ({
        value: c.id,
        label: c.name,
        description: c.legal_name ?? undefined,
      })),
    [options.clients]
  );

  const brandOptions = useMemo(() => {
    const filtered = activeClientId
      ? options.brands.filter((b) => b.client_id === activeClientId)
      : options.brands;
    return filtered.map((b) => ({ value: b.id, label: b.name }));
  }, [activeClientId, options.brands]);

  const campaignOptions = useMemo(
    () =>
      options.campaigns.map((c) => ({
        value: c.id,
        label: c.document_number ? `${c.name} (${c.document_number})` : c.name,
      })),
    [options.campaigns]
  );

  function saveMaster(patch: {
    client_id?: string | null;
    brand_id?: string | null;
    campaign_header_id?: string | null;
  }) {
    startTransition(async () => {
      const res = await updateQuotationHeader({ id: detail.id, ...patch });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
    });
  }

  function handleClientChange(clientId: string) {
    if (!clientId) return;
    if (wizard) {
      saveMaster({ client_id: clientId, brand_id: null, campaign_header_id: null });
      return;
    }
    setLocalClientId(clientId);
    setLocalBrandId("");
    setLocalCampaignId("");
    syncManualSave({ clientId, brandId: "", campaignId: "" });
  }

  function handleBrandChange(brandId: string) {
    if (!brandId || !activeClientId) return;
    if (wizard) {
      saveMaster({ brand_id: brandId });
      return;
    }
    setLocalBrandId(brandId);
    syncManualSave({ brandId });
  }

  function handleCampaignChange(campaignId: string) {
    if (wizard) {
      saveMaster({ campaign_header_id: campaignId || null });
      return;
    }
    setLocalCampaignId(campaignId);
    syncManualSave({ campaignId });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
      <div className="md:col-span-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="temp-client-brand"
            checked={useTemporary}
            onCheckedChange={(checked) => setUseTemporary(Boolean(checked))}
            disabled={disabled || pending}
          />
          <Label htmlFor="temp-client-brand" className="text-xs font-normal">
            Use temporary client &amp; brand (quotation-scoped until promoted)
          </Label>
        </div>
        {!wizard && manualSave.hasClientBrandPending ? (
          <span className="text-[10px] text-[var(--camp-amber)]">
            {manualSave.saveStatus === "saving"
              ? "Saving…"
              : manualSave.saveStatus === "error"
                ? "Save failed"
                : "Unsaved — use Save below"}
          </span>
        ) : null}
      </div>

      {useTemporary ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Temporary legal entity
            </Label>
            <Input
              value={tempClient}
              onChange={(e) => setTempClient(e.target.value)}
              disabled={disabled || pending}
              placeholder="Client name for this quotation"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Temporary brand
            </Label>
            <Input
              value={tempBrand}
              onChange={(e) => setTempBrand(e.target.value)}
              disabled={disabled || pending}
              placeholder="Brand name for this quotation"
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Legal entity (required)
            </Label>
            <SearchableSelect
              options={[{ value: "", label: "Select client…" }, ...clientOptions]}
              value={activeClientId ?? ""}
              onValueChange={handleClientChange}
              disabled={disabled || pending}
              placeholder="Select client"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Brand (required)
            </Label>
            <SearchableSelect
              options={[{ value: "", label: "Select brand…" }, ...brandOptions]}
              value={activeBrandId ?? ""}
              onValueChange={handleBrandChange}
              disabled={disabled || pending || !activeClientId}
              placeholder={activeClientId ? "Select brand" : "Select client first"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Campaign (optional)
            </Label>
            <SearchableSelect
              options={[{ value: "", label: "No campaign" }, ...campaignOptions]}
              value={activeCampaignId ?? ""}
              onValueChange={handleCampaignChange}
              disabled={disabled || pending}
              placeholder="Link campaign"
            />
          </div>
        </>
      )}
    </div>
  );
}
