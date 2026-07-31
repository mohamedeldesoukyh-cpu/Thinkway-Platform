import {
  getEmailProvider,
  getEmailReplyTo,
} from "@/lib/email/provider";

export type IoDeliveryNotificationMeta = {
  provider: string;
  recipient: string;
  subject: string | null;
  delivery_method: "email" | "manual";
  delivery_status: "sent" | "failed" | "completed";
  reply_to: string;
  message_id: string | null;
  sent_at: string;
};

/** Standard delivery metadata for io_notifications.payload (audit / reporting). */
export function buildIoDeliveryNotificationMeta(input: {
  deliveryMethod: "email" | "manual";
  deliveryStatus: "sent" | "failed" | "completed";
  recipient: string;
  subject?: string | null;
  messageId?: string | null;
  sentAt: string;
}): IoDeliveryNotificationMeta {
  return {
    provider:
      input.deliveryMethod === "manual" ? "manual" : getEmailProvider(),
    recipient: input.recipient,
    subject: input.subject ?? null,
    delivery_method: input.deliveryMethod,
    delivery_status: input.deliveryStatus,
    reply_to: getEmailReplyTo(),
    message_id: input.messageId ?? null,
    sent_at: input.sentAt,
  };
}
