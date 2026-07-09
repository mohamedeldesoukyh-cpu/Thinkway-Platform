"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuotationClientBrandPanel } from "@/features/quotations/components/quotation-client-brand-panel";
import { updateQuotationClientBrand } from "@/features/quotations/lifecycle-actions";
import type { QuotationDetail, QuotationFormOptions } from "@/features/quotations/types";

type Props = {
  detail: QuotationDetail;
  options: QuotationFormOptions;
};

export function QuotationSetupWizard({ detail, options }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [useTemporary, setUseTemporary] = useState(
    detail.is_temporary_client || detail.is_temporary_brand
  );
  const [tempClient, setTempClient] = useState(detail.temporary_client_name ?? "");
  const [tempBrand, setTempBrand] = useState(detail.temporary_brand_name ?? "");

  const needsSetup =
    !detail.canManage
      ? false
      : detail.is_temporary_client
        ? !detail.temporary_client_name || !detail.temporary_brand_name
        : !detail.client_id || !detail.brand_id;

  useEffect(() => {
    setOpen(needsSetup && detail.canManage);
  }, [needsSetup, detail.canManage]);

  useEffect(() => {
    setUseTemporary(detail.is_temporary_client || detail.is_temporary_brand);
    setTempClient(detail.temporary_client_name ?? "");
    setTempBrand(detail.temporary_brand_name ?? "");
  }, [
    detail.id,
    detail.is_temporary_client,
    detail.is_temporary_brand,
    detail.temporary_client_name,
    detail.temporary_brand_name,
  ]);

  const canContinue = useTemporary
    ? Boolean(tempClient.trim() && tempBrand.trim())
    : Boolean(detail.client_id && detail.brand_id);

  function handleContinue() {
    if (!canContinue) {
      toast.error("Select or enter client and brand to continue.");
      return;
    }

    startTransition(async () => {
      if (useTemporary) {
        const res = await updateQuotationClientBrand({
          quotationId: detail.id,
          is_temporary_client: true,
          temporary_client_name: tempClient.trim(),
          temporary_brand_name: tempBrand.trim(),
        });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
      } else if (!detail.client_id || !detail.brand_id) {
        toast.error("Select legal entity and brand to continue.");
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  if (!needsSetup) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="thinkway-campaign-workspace max-w-2xl gap-4 p-0 sm:max-w-2xl">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle>Link client &amp; brand</DialogTitle>
            <DialogDescription>
              Client quotations require a legal entity and brand before you save or export.
              Campaign linkage is optional.
            </DialogDescription>
          </DialogHeader>
        </div>
        <QuotationClientBrandPanel
          detail={detail}
          options={options}
          wizard={{
            useTemporary,
            tempClient,
            tempBrand,
            onUseTemporaryChange: setUseTemporary,
            onTempClientChange: setTempClient,
            onTempBrandChange: setTempBrand,
          }}
        />
        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button onClick={handleContinue} disabled={!canContinue || pending}>
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Continue to workspace"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
