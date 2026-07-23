import Link from "next/link";
import type { ComponentProps } from "react";

type AppNavLinkProps = ComponentProps<typeof Link>;

/**
 * Dashboard navigation link.
 * Prefetch is enabled in production for instant transitions; disabled in
 * development so Turbopack does not compile every sidebar route on hover.
 */
export function AppNavLink({ prefetch, ...props }: AppNavLinkProps) {
  const resolvedPrefetch =
    prefetch ?? process.env.NODE_ENV === "production";
  return <Link prefetch={resolvedPrefetch} {...props} />;
}
