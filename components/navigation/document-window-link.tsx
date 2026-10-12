"use client";

import type { ComponentProps } from "react";

/** Open documents separately and remember the exact source page for Back. */
export function DocumentWindowLink({ href, children, ...props }: ComponentProps<"a"> & { href: string }) {
  function captureSource(event: { currentTarget: HTMLAnchorElement }) {
    const destination = new URL(href, window.location.origin);
    destination.searchParams.set("returnTo", window.location.pathname + window.location.search + window.location.hash);
    event.currentTarget.href = destination.toString();
  }
  return <a {...props} href={href} target="_blank" rel="noopener noreferrer"
    onClick={event => { captureSource(event); props.onClick?.(event); }}
    onAuxClick={event => { captureSource(event); props.onAuxClick?.(event); }}
    onContextMenu={event => { captureSource(event); props.onContextMenu?.(event); }}
    onFocus={event => { captureSource(event); props.onFocus?.(event); }}>
    {children}
  </a>;
}
