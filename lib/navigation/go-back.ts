import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Navigate to the previous in-app page when possible; otherwise use fallback.
 */
export function navigateBack(router: AppRouterInstance, fallbackHref: string) {
  if (typeof window === "undefined") {
    router.push(fallbackHref);
    return;
  }

  const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof historyIdx === "number" && historyIdx > 0) {
    router.back();
    return;
  }

  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push(fallbackHref);
}
