"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateQuotationHeader } from "@/features/quotations/actions";
import { updateQuotationClientBrand } from "@/features/quotations/lifecycle-actions";
import type { QuotationDetail, QuotationFormOptions } from "@/features/quotations/types";

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
  const [pending, startTransition] = useTransition();
  const [localTemporary, setLocalTemporary] = useState(
    detail.is_temporary_client || detail.is_temporary_brand
  );
  const [localTempClient, setLocalTempClient] = useState(detail.temporary_client_name ?? "");
  const [localTempBrand, setLocalTempBrand] = useState(detail.temporary_brand_name ?? "");

  const useTemporary = wizard?.useTemporary ?? localTemporary;
  const tempClient = wizard?.tempClient ?? localTempClient;
  const tempBrand = wizard?.tempBrand ?? localTempBrand;

  function setUseTemporary(value: boolean) {
    if (wizard) wizard.onUseTemporaryChange(value);
    else setLocalTemporary(value);
  }

  function setTempClient(value: string) {
    if (wizard) wizard.onTempClientChange(value);
    else setLocalTempClient(value);
  }

  function setTempBrand(value: string) {
    if (wizard) wizard.onTempBrandChange(value);
    else setLocalTempBrand(value);
  }

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
    const filtered = detail.client_id
      ? options.brands.filter((b) => b.client_id === detail.client_id)
      : options.brands;
    return filtered.map((b) => ({ value: b.id, label: b.name }));
  }, [detail.client_id, options.brands]);

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

  function saveTemporary() {
    startTransition(async () => {
      const res = await updateQuotationClientBrand({
        quotationId: detail.id,
        is_temporary_client: true,
        temporary_client_name: tempClient,
        temporary_brand_name: tempBrand,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
      <div className="md:col-span-3 flex items-center gap-2">
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
          <div className="flex items-end">
            <button
              type="button"
              className="text-xs text-primary hover:underline disabled:opacity-50"
              disabled={disabled || pending || !tempClient.trim() || !tempBrand.trim()}
              onClick={saveTemporary}
            >
              Save temporary values
            </button>
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
              value={detail.client_id ?? ""}
              onValueChange={(clientId) => {
                if (!clientId) return;
                saveMaster({ client_id: clientId, brand_id: null, campaign_header_id: null });
              }}
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
              value={detail.brand_id ?? ""}
              onValueChange={(brandId) => {
                if (!brandId || !detail.client_id) return;
                saveMaster({ brand_id: brandId });
              }}
              disabled={disabled || pending || !detail.client_id}
              placeholder={detail.client_id ? "Select brand" : "Select client first"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Campaign (optional)
            </Label>
            <SearchableSelect
              options={[{ value: "", label: "No campaign" }, ...campaignOptions]}
              value={detail.campaign_header_id ?? ""}
              onValueChange={(campaignId) =>
                saveMaster({ campaign_header_id: campaignId || null })
              }
              disabled={disabled || pending}
              placeholder="Link campaign"
            />
          </div>
        </>
      )}
    </div>
  );
}
