"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DETAIL_FORM_SELECT_TRIGGER_CLASS } from "@/features/campaigns/components/operational-detail-panel";
import type { ClientIoSendRecipient } from "@/features/io/types";
import { cn } from "@/lib/utils";

type ClientIoRecipientSelectProps = {
  recipients: ClientIoSendRecipient[];
  value: string;
  onValueChange: (email: string) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ClientIoRecipientSelect({
  recipients,
  value,
  onValueChange,
  disabled,
  compact,
}: ClientIoRecipientSelectProps) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        aria-label="Send to client"
        className={cn(
          DETAIL_FORM_SELECT_TRIGGER_CLASS,
          compact ? "h-7 min-w-[10rem] text-[11px]" : "min-w-[12rem]"
        )}
      >
        <SelectValue placeholder="Send to client" />
      </SelectTrigger>
      <SelectContent>
        {recipients.length === 0 ? (
          <SelectItem value="__none__" disabled>
            No client contacts configured
          </SelectItem>
        ) : (
          recipients.map((recipient) => (
            <SelectItem key={recipient.id} value={recipient.email}>
              {recipient.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
