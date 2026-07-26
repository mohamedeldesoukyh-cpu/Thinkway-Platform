/** Client-side PWA install prompt persistence (localStorage). */

export const PWA_DISMISS_KEY = "thinkway.pwa.dismissedAt";
export const PWA_INSTALLED_KEY = "thinkway.pwa.installed";
export const PWA_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

export function isPwaInstallDismissed(now = Date.now()): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(PWA_DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Date.parse(raw);
    if (Number.isNaN(dismissedAt)) return false;
    return now - dismissedAt < PWA_DISMISS_MS;
  } catch {
    return false;
  }
}

export function markPwaInstallDismissed(now = Date.now()): void {
  try {
    window.localStorage.setItem(PWA_DISMISS_KEY, new Date(now).toISOString());
  } catch {
    // ignore quota / private mode
  }
}

export function isPwaMarkedInstalled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PWA_INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPwaInstalled(): void {
  try {
    window.localStorage.setItem(PWA_INSTALLED_KEY, "1");
    window.localStorage.removeItem(PWA_DISMISS_KEY);
  } catch {
    // ignore
  }
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.matchMedia("(display-mode: minimal-ui)").matches;
}
