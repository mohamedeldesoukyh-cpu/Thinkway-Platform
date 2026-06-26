"use client";

import { getThemeBlockingScriptHtml } from "@/lib/theme/blocking-script";

/**
 * Blocking theme init for SSR HTML only. Returns null on the client so React 19
 * never reconciles a <script> during hydration (see next-themes PR #386).
 */
export function ThemeHeadScript() {
  if (typeof window !== "undefined") {
    return null;
  }

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: getThemeBlockingScriptHtml() }}
    />
  );
}
