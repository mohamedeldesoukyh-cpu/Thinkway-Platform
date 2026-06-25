"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Label } from "@/components/ui/label";
import { updateQuotationHeader } from "@/features/quotations/actions";
import type { QuotationDetail, QuotationFormOptions } from "@/features/quotations/types";

type Props = {
  detail: QuotationDetail;
  options: QuotationFormOptions;
  disabled?: boolean;
};

export function QuotationClientBrandPanel({ detail, options, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  function save(patch: {
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

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Legal entity (required)
        </Label>
        <SearchableSelect
          options={[{ value: "", label: "Select client…" }, ...clientOptions]}
          value={detail.client_id ?? ""}
          onValueChange={(clientId) => {
            if (!clientId) return;
            save({ client_id: clientId, brand_id: null, campaign_header_id: null });
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
            save({ brand_id: brandId });
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
            save({ campaign_header_id: campaignId || null })
          }
          disabled={disabled || pending}
          placeholder="Link campaign"
        />
      </div>
    </div>
  );
}
