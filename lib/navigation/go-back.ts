import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/** Navigate to the explicit parent route (never browser history). */
export function navigateBack(router: AppRouterInstance, fallbackHref: string) {
  router.push(fallbackHref);
}
