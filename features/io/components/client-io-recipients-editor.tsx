"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirmDelete } from "@/components/shared/confirm-action-provider";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Input } from "@/components/ui/input";
import { CollapsibleWorkspaceSection } from "@/components/workspace/collapsible-workspace-section";
import { DETAIL_FORM_INPUT_CLASS } from "@/features/campaigns/components/operational-detail-panel";
import { getEmailFromAddress } from "@/lib/email/provider";
import {
  applyRecipientEmailEdit,
  clientIoDocumentRecipients,
  type ClientIoRecipientEntry,
} from "@/lib/io/client-io-send-recipients";

type Props = {
  recipients: ClientIoRecipientEntry[];
  onChange: (recipients: ClientIoRecipientEntry[]) => void;
  disabled?: boolean;
  saving?: boolean;
  saveFormId?: string;
  /** When true, recipients are shown but not yet stored — Save draft is required. */
  unsavedHint?: boolean;
};

export function ClientIoRecipientsEditor({
  recipients,
  onChange,
  disabled,
  saving,
  saveFormId,
  unsavedHint = false,
}: Props) {
  const confirmDelete = useConfirmDelete();
  const fromEmail = getEmailFromAddress();

  function updateRecipient(index: number, patch: Partial<ClientIoRecipientEntry>) {
    const main = clientIoDocumentRecipients(recipients);
    onChange(recipients.map((row, i) => ({ ...row, documentRole: main.includes(row) ? "main" : "other", ...(i === index ? patch : {}) })));
  }

  async function removeRecipient(index: number) {
    const ok = await confirmDelete(
      "Remove this recipient from the IO send list?",
      "Remove recipient?"
    );
    if (!ok) return;
    const main = clientIoDocumentRecipients(recipients);
    onChange(recipients.filter((_, i) => i !== index).map(row => ({ ...row, documentRole: main.includes(row) ? "main" : "other" })));
  }

  function addRecipient() {
    const main = clientIoDocumentRecipients(recipients);
    onChange([...recipients.map(row => ({ ...row, documentRole: main.includes(row) ? "main" as const : "other" as const })), { name: "", email: "", role: "to", documentRole: recipients.length === 0 ? "main" : "other" }]);
  }

  const documentRecipients = clientIoDocumentRecipients(recipients);
  const recipientCount = recipients.filter((r) => r.email.trim()).length;

  return (
    <CollapsibleWorkspaceSection
      title="IO recipients"
      summary={
        recipientCount > 0
          ? `${recipientCount} recipient${recipientCount === 1 ? "" : "s"} · from ${fromEmail}`
          : `Add contacts · from ${fromEmail}`
      }
      defaultOpen={false}
    >
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Add one or more client contacts who will receive this Client IO from{" "}
        <strong className="font-medium text-foreground">{fromEmail}</strong>. Choose TO, CC or BCC for delivery. Choose Main for contacts shown on the Client IO document; Others receive email only. Traffic and the sending user are automatically BCC’d. Paste several emails separated by commas if needed.{" "}
        {unsavedHint
          ? "Send uses this list immediately; Save recipients stores it for next time."
          : "Send delivers to everyone listed below."}
      </p>
      <div className="space-y-2">
        {recipients.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
            No recipients yet. Add a contact below.
          </p>
        ) : (
          recipients.map((recipient, index) => (
            <div
              key={`recipient-${index}`}
              className="grid gap-2 rounded-md border border-border/60 bg-muted/10 p-3 lg:grid-cols-[5rem_6rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-2"
            >
              <select aria-label="Recipient role" className={DETAIL_FORM_INPUT_CLASS} value={recipient.role ?? "to"}
                disabled={disabled} onChange={e => updateRecipient(index, { role: e.target.value as "to" | "cc" | "bcc" })}>
                <option value="to">TO</option><option value="cc">CC</option><option value="bcc">BCC</option>
              </select>
              <select aria-label="Show contact on Client IO" className={DETAIL_FORM_INPUT_CLASS}
                value={documentRecipients.includes(recipient) ? "main" : "other"} disabled={disabled}
                onChange={e => onChange(recipients.map((row, i) => ({ ...row, documentRole: i === index ? e.target.value as "main" | "other" : documentRecipients.includes(row) ? "main" : "other" })))}>
                <option value="main">Main</option><option value="other">Others</option>
              </select>
              <Input aria-label="Contact name"
                value={recipient.name}
                onChange={(e) => updateRecipient(index, { name: e.target.value })}
                placeholder="Contact name"
                className={DETAIL_FORM_INPUT_CLASS}
                disabled={disabled}
              />
              <Input
                type="text"
                aria-label="Recipient email"
                inputMode="email"
                autoComplete="email"
                value={recipient.email}
                onChange={(e) =>
                  onChange(applyRecipientEmailEdit(recipients, index, e.target.value))
                }
                placeholder="email@client.com (or paste several)"
                className={DETAIL_FORM_INPUT_CLASS}
                disabled={disabled}
              />
              <TooltipIconButton
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => void removeRecipient(index)}
                disabled={disabled}
                tooltip="Remove recipient"
              >
                <Trash2Icon className="size-4" />
              </TooltipIconButton>
            </div>
          ))
        )}
        {saveFormId ? <Button type="submit" form={saveFormId} disabled={disabled} className="mr-2 min-h-11">
          {saving ? "Saving…" : "Save recipients"}
        </Button> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={addRecipient}
          disabled={disabled}
        >
          <PlusIcon className="mr-1.5 size-3.5" />
          Add recipient
        </Button>
      </div>
    </CollapsibleWorkspaceSection>
  );
}
