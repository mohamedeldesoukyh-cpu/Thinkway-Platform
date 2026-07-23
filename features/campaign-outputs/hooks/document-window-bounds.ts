export type DocumentWindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const MIN_WINDOW_WIDTH = 480;
export const MIN_WINDOW_HEIGHT = 360;
export const SIDE_MARGIN = 8;
export const EDGE_SNAP_THRESHOLD = 12;

export function clampScalar(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

export function getDefaultWindowBounds(
  viewport: { width: number; height: number },
  options: { wide?: boolean } = {}
): DocumentWindowBounds {
  const { wide = false } = options;
  const width = Math.min(wide ? 1280 : 1120, wide ? viewport.width * 0.98 : viewport.width * 0.96);
  const height = Math.min(viewport.height * 0.85, 880);
  return {
    x: (viewport.width - width) / 2,
    y: (viewport.height - height) / 2,
    width,
    height,
  };
}

export function clampWindowBounds(
  bounds: DocumentWindowBounds,
  viewport: { width: number; height: number },
  options: {
    minWidth?: number;
    minHeight?: number;
    sideMargin?: number;
  } = {}
): { bounds: DocumentWindowBounds; hitTop: boolean } {
  const {
    minWidth = MIN_WINDOW_WIDTH,
    minHeight = MIN_WINDOW_HEIGHT,
    sideMargin = SIDE_MARGIN,
  } = options;

  const vw = viewport.width;
  const vh = viewport.height;
  const maxWidth = Math.max(minWidth, vw - sideMargin * 2);
  const maxHeight = Math.max(minHeight, vh - sideMargin * 2);

  let width = clampScalar(bounds.width, minWidth, maxWidth);
  let height = clampScalar(bounds.height, minHeight, maxHeight);
  let x = bounds.x;
  let y = bounds.y;

  const hitTopAttempt = y < 0;

  if (x + width > vw) {
    x = vw - width;
  }
  if (y + height > vh) {
    y = vh - height;
  }

  x = clampScalar(x, 0, Math.max(0, vw - width));
  y = clampScalar(y, 0, Math.max(0, vh - height));

  return {
    bounds: { x, y, width, height },
    hitTop: hitTopAttempt && y === 0,
  };
}

export function snapWindowBounds(
  bounds: DocumentWindowBounds,
  viewport: { width: number; height: number },
  threshold = EDGE_SNAP_THRESHOLD
): DocumentWindowBounds {
  const vw = viewport.width;
  const vh = viewport.height;
  let { x, y, width, height } = bounds;

  if (x <= threshold) x = 0;
  if (y <= threshold) y = 0;
  if (vw - (x + width) <= threshold) x = vw - width;
  if (vh - (y + height) <= threshold) y = vh - height;

  return { x, y, width, height };
}

export function applyResizeDelta(
  origin: DocumentWindowBounds,
  handle: ResizeHandle,
  delta: { dx: number; dy: number }
): DocumentWindowBounds {
  let { x, y, width, height } = origin;

  if (handle.includes("e")) {
    width = origin.width + delta.dx;
  }
  if (handle.includes("w")) {
    x = origin.x + delta.dx;
    width = origin.width - delta.dx;
  }
  if (handle.includes("s")) {
    height = origin.height + delta.dy;
  }
  if (handle.includes("n")) {
    y = origin.y + delta.dy;
    height = origin.height - delta.dy;
  }

  return { x, y, width, height };
}

export const RESIZE_HANDLES: ResizeHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

export const RESIZE_HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  sw: "nesw-resize",
};
