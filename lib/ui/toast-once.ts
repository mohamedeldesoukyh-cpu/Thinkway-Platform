import { toast } from "sonner";

const shownToastKeys = new Set<string>();

function buildToastKey(kind: "success" | "error", id: string, message: string): string {
  return `${kind}:${id}:${message}`;
}

export function showSuccessToastOnce(
  message: string,
  options?: { id?: string; duration?: number }
): boolean {
  const id = options?.id ?? "success";
  const key = buildToastKey("success", id, message);
  if (shownToastKeys.has(key)) return false;
  shownToastKeys.add(key);
  toast.success(message, { id: key, duration: options?.duration ?? 4000 });
  return true;
}

export function showErrorToastOnce(
  message: string,
  options?: { id?: string; duration?: number }
): boolean {
  const id = options?.id ?? "error";
  const key = buildToastKey("error", id, message);
  if (shownToastKeys.has(key)) return false;
  shownToastKeys.add(key);
  toast.error(message, { id: key, duration: options?.duration ?? 5000 });
  return true;
}

/** Call when a sheet/dialog closes so the same action can toast again on next submit. */
export function resetToastOnce(id: string): void {
  for (const key of [...shownToastKeys]) {
    if (key.includes(`:${id}:`)) shownToastKeys.delete(key);
  }
}
