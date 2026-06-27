"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { updateVendorIoSpecialPaymentTermsAction } from "@/features/io/update-vendor-io-special-payment-terms-action";
import type { VendorIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: VendorIoRow;
};

export function VendorIoSpecialPaymentTermsCell({ row }: Props) {
  const [value, setValue] = useState(row.special_payment_terms ?? "");
  const [state, action, pending] = useActionState(
    updateVendorIoSpecialPaymentTermsAction,
    INITIAL_STATE
  );

  useEffect(() => {
    setValue(row.special_payment_terms ?? "");
  }, [row.special_payment_terms, row.updated_at]);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="min-w-[10rem]">
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
      <Input
        name="special_payment_terms"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => {
          if ((row.special_payment_terms ?? "") === event.target.value.trim()) return;
          event.currentTarget.form?.requestSubmit();
        }}
        placeholder="Agreed terms…"
        disabled={pending}
        className={cn(
          "h-7 border-transparent bg-transparent px-0 text-[11px] text-[var(--camp-text-3)] shadow-none focus-visible:ring-0",
          row.special_payment_terms?.trim() && "text-[var(--camp-text-2)]"
        )}
      />
    </form>
  );
}
