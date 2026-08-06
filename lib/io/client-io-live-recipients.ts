import type { ClientIoRecipientEntry } from "@/lib/io/client-io-send-recipients";
import { parseSendRecipientsJson } from "@/lib/io/client-io-send-recipients";

const EVENT = "thinkway:client-io-recipients";

function storageKey(clientIoId: string): string {
  return `thinkway:client-io-recipients:${clientIoId}`;
}

/** Publish the live recipient list so hero toolbar Send matches the form editor. */
export function publishClientIoLiveRecipients(
  clientIoId: string,
  recipients: ClientIoRecipientEntry[]
): void {
  if (typeof window === "undefined" || !clientIoId) return;
  try {
    window.sessionStorage.setItem(storageKey(clientIoId), JSON.stringify(recipients));
    window.dispatchEvent(
      new CustomEvent(EVENT, { detail: { clientIoId, recipients } })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function readClientIoLiveRecipients(
  clientIoId: string
): ClientIoRecipientEntry[] {
  if (typeof window === "undefined" || !clientIoId) return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(clientIoId));
    if (!raw) return [];
    return parseSendRecipientsJson(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function subscribeClientIoLiveRecipients(
  clientIoId: string,
  onChange: (recipients: ClientIoRecipientEntry[]) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as
      | { clientIoId?: string; recipients?: ClientIoRecipientEntry[] }
      | undefined;
    if (!detail || detail.clientIoId !== clientIoId) return;
    onChange(Array.isArray(detail.recipients) ? detail.recipients : []);
  };

  window.addEventListener(EVENT, handler as EventListener);
  return () => window.removeEventListener(EVENT, handler as EventListener);
}
