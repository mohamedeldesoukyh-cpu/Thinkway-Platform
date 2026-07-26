import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { toSafeHref } from "@/lib/security/safe-external-url";

type SafeExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string | null | undefined;
  /** When true, allow http:// hrefs (legacy content). Default false. */
  allowHttp?: boolean;
  /** When true, allow mailto: hrefs (contact links). Default false. */
  allowMailto?: boolean;
  fallback?: ReactNode;
};

/**
 * Renders an external <a> only when href passes scheme validation.
 * Unsafe or relative values render fallback (default: null).
 */
export function SafeExternalLink({
  href,
  allowHttp = false,
  allowMailto = false,
  fallback = null,
  children,
  rel,
  target = "_blank",
  ...rest
}: SafeExternalLinkProps) {
  const safe = toSafeHref(href, { allowHttp, allowMailto });
  if (!safe) {
    return <>{fallback}</>;
  }

  const isMailto = safe.startsWith("mailto:");

  return (
    <a
      href={safe}
      target={isMailto ? undefined : target}
      rel={isMailto ? undefined : (rel ?? "noopener noreferrer")}
      {...rest}
    >
      {children}
    </a>
  );
}
