"use client";

import type { ComponentProps } from "react";
import { openDocumentPreview } from "@/lib/navigation/preview-navigation";

/** Keep normal preview clicks in the app cache; retain browser new-tab shortcuts. */
export function DocumentWindowLink({ href, children, ...props }: ComponentProps<"a"> & { href: string }) {
  function captureSource(event: { currentTarget: HTMLAnchorElement }) {
    const destination = new URL(href, window.location.origin);
    destination.searchParams.set("returnTo", window.location.pathname + window.location.search + window.location.hash);
    event.currentTarget.href = destination.toString();
  }
  return <a {...props} href={href} target="_blank" rel="noopener noreferrer"
    onClick={event => {
      captureSource(event);
      props.onClick?.(event);
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = new URL(event.currentTarget.href);
      if (destination.origin !== window.location.origin || !/\/preview\/?$/.test(destination.pathname)) return;
      event.preventDefault();
      openDocumentPreview(destination.pathname + destination.search + destination.hash);
    }}
    onAuxClick={event => { captureSource(event); props.onAuxClick?.(event); }}
    onContextMenu={event => { captureSource(event); props.onContextMenu?.(event); }}
    onFocus={event => { captureSource(event); props.onFocus?.(event); }}>
    {children}
  </a>;
}
