"use client";

import { SaveIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Modal focus trapping also blocks keyboard edits in the quotation and its drawers. */
export function QuotationSavingDialog({ open }: { open: boolean }) {
  return <Dialog open={open}>
    <DialogContent showCloseButton={false} className="q-saving-dialog"
      overlayClassName="q-saving-overlay"
      onEscapeKeyDown={event => event.preventDefault()}
      onInteractOutside={event => event.preventDefault()}>
      <div className="q-saving-mark" aria-hidden="true"><SaveIcon /><span /></div>
      <div role="status" aria-live="polite" aria-busy="true">
        <DialogTitle>Saving quotation</DialogTitle>
        <DialogDescription>Keeping your changes safe. Editing will resume when saving finishes.</DialogDescription>
      </div>
      <div className="q-saving-track" aria-hidden="true"><span /></div>
    </DialogContent>
  </Dialog>;
}
