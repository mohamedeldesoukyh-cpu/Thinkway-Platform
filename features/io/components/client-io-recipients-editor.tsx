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
  type ClientIoRecipientEntry,
} from "@/lib/io/client-io-send-recipients";

type Props = {
  recipients: ClientIoRecipientEntry[];
  onChange: (recipients: ClientIoRecipientEntry[]) => void;
  disabled?: boolean;
  /** When true, recipients are shown but not yet stored — Save draft is required. */
  unsavedHint?: boolean;
};

export function ClientIoRecipientsEditor({
  recipients,
  onChange,
  disabled,
  unsavedHint = false,
}: Props) {
  const confirmDelete = useConfirmDelete();
  const fromEmail = getEmailFromAddress();

  function updateRecipient(index: number, patch: Partial<ClientIoRecipientEntry>) {
    onChange(recipients.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function removeRecipient(index: number) {
    const ok = await confirmDelete(
      "Remove this recipient from the IO send list?",
      "Remove recipient?"
    );
    if (!ok) return;
    onChange(recipients.filter((_, i) => i !== index));
  }

  function addRecipient() {
    onChange([...recipients, { name: "", email: "" }]);
  }

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
        <strong className="font-medium text-foreground">{fromEmail}</strong>. Each
        address gets its own email. Paste several emails separated by commas if needed.{" "}
        {unsavedHint
          ? "Send uses this list immediately; Save draft stores it for next time."
          : "Send delivers to everyone listed below."}
      </p>
      <div className="space-y-2">
        {recipients.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
            No recipients yet. Add a contact or pick from client contacts saved on the legal entity.
          </p>
        ) : (
          recipients.map((recipient, index) => (
            <div
              key={`recipient-${index}`}
              className="grid gap-2 rounded-md border border-border/60 bg-muted/10 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                value={recipient.name}
                onChange={(e) => updateRecipient(index, { name: e.target.value })}
                placeholder="Contact name"
                className={DETAIL_FORM_INPUT_CLASS}
                disabled={disabled}
              />
              <Input
                type="text"
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
