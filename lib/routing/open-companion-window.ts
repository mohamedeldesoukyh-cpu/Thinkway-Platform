/**
 * Open a same-origin route in a separate full-size browser window so the
 * current workspace stays on screen (side-by-side with the companion).
 *
 * Named windows reuse an existing companion instead of stacking duplicates.
 */
export function openCompanionWindow(url: string, windowName: string): Window | null {
  const host = globalThis.window;
  if (!host) return null;

  const availWidth = host.screen?.availWidth ?? host.innerWidth;
  const availHeight = host.screen?.availHeight ?? host.innerHeight;
  const width = Math.max(Math.floor(availWidth), 1024);
  const height = Math.max(Math.floor(availHeight), 720);
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    "left=0",
    "top=0",
    "menubar=no",
    "toolbar=no",
    "location=yes",
    "status=no",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");

  const companion = host.open(url, windowName, features);
  if (!companion) {
    return host.open(url, windowName);
  }
  companion.focus();
  return companion;
}

export function closeCompanionWindow(): boolean {
  const host = globalThis.window;
  if (!host) return false;
  host.close();
  return host.closed;
}
