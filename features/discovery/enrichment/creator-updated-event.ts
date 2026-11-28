/** Only a revision signal is shared across tabs; creator data stays in authenticated requests. */
export const CREATOR_UPDATED_EVENT = "thinkway:creator-updated";

export function notifyCreatorUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREATOR_UPDATED_EVENT));
  try {
    window.localStorage.setItem(CREATOR_UPDATED_EVENT, `${Date.now()}:${Math.random()}`);
  } catch { /* Same-tab updates still work when storage is unavailable. */ }
}

export function subscribeCreatorUpdates(refresh: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === CREATOR_UPDATED_EVENT) refresh();
  };
  window.addEventListener(CREATOR_UPDATED_EVENT, refresh);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CREATOR_UPDATED_EVENT, refresh);
    window.removeEventListener("storage", onStorage);
  };
}
