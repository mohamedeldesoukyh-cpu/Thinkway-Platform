"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import type { QuotationDetail, QuotationFormOptions } from "@/features/quotations/types";

type Props = {
  detail: QuotationDetail;
  options: QuotationFormOptions;
};

export function QuotationSetupWizard({ detail, options }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const needsSetup =
    !detail.canManage
      ? false
      : detail.is_temporary_client
        ? !detail.temporary_client_name || !detail.temporary_brand_name
        : !detail.client_id || !detail.brand_id;

  useEffect(() => {
    setOpen(needsSetup && detail.canManage);
  }, [needsSetup, detail.canManage]);

  function handleContinue() {
    const ready =
      detail.is_temporary_client
        ? detail.temporary_client_name && detail.temporary_brand_name
        : detail.client_id && detail.brand_id;
    if (!ready) {
      toast.error("Select or enter client and brand to continue.");
      return;
    }
    startTransition(() => {
      setOpen(false);
      router.refresh();
    });
  }

  if (!needsSetup) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link client &amp; brand</DialogTitle>
          <DialogDescription>
            Client quotations require a legal entity and brand before you save or export.
            Campaign linkage is optional.
          </DialogDescription>
        </DialogHeader>
        <QuotationClientBrandPanel detail={detail} options={options} />
        <DialogFooter>
          <Button
            onClick={handleContinue}
            disabled={
              detail.is_temporary_client
                ? !detail.temporary_client_name || !detail.temporary_brand_name
                : !detail.client_id || !detail.brand_id
            }
          >
            Continue to workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
