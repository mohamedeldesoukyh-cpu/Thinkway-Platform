"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  clampWindowBounds,
  getDefaultWindowBounds,
  applyResizeDelta,
  snapWindowBounds,
  type DocumentWindowBounds,
  type ResizeHandle,
} from "./document-window-bounds";

const NO_DRAG_SELECTOR = "button, a, input, select, textarea, [data-no-drag]";

function isNoDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(NO_DRAG_SELECTOR));
}

function getViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

type UseResizableDocumentWindowOptions = {
  wide?: boolean;
  /** When false, drag/resize is disabled but bounds are preserved (e.g. maximized). */
  interactive?: boolean;
};

/**
 * Top-left anchored floating document window — drag via header, resize via edge/corner handles.
 * Resets bounds when `open` becomes false (panel closed).
 */
function boundsEqual(a: DocumentWindowBounds, b: DocumentWindowBounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function useResizableDocumentWindow(
  open: boolean,
  options: UseResizableDocumentWindowOptions = {}
) {
  const { wide = false, interactive = true } = options;
  const wideRef = useRef(wide);
  wideRef.current = wide;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState<DocumentWindowBounds>(() =>
    getDefaultWindowBounds(getViewport(), { wide })
  );
  const [hitTopClamp, setHitTopClamp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: DocumentWindowBounds;
  } | null>(null);

  const resizeRef = useRef<{
    pointerId: number;
    handle: ResizeHandle;
    startX: number;
    startY: number;
    origin: DocumentWindowBounds;
  } | null>(null);

  const hitTopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyBounds = useCallback((next: DocumentWindowBounds, snap = false): DocumentWindowBounds => {
    const viewport = getViewport();
    let candidate = next;
    if (snap) {
      candidate = snapWindowBounds(candidate, viewport);
    }
    const { bounds: clamped, hitTop } = clampWindowBounds(candidate, viewport);

    if (hitTop) {
      setHitTopClamp(true);
      if (hitTopTimerRef.current) clearTimeout(hitTopTimerRef.current);
      hitTopTimerRef.current = setTimeout(() => setHitTopClamp(false), 350);
    }

    return clamped;
  }, []);

  const syncBounds = useCallback(() => {
    if (dragRef.current || resizeRef.current) return;
    setBounds((prev) => {
      const next = applyBounds(prev);
      return boundsEqual(prev, next) ? prev : next;
    });
  }, [applyBounds]);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setBounds(getDefaultWindowBounds(getViewport(), { wide: wideRef.current }));
      setHitTopClamp(false);
      setIsDragging(false);
      setIsResizing(false);
      dragRef.current = null;
      resizeRef.current = null;
      return;
    }

    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setBounds(getDefaultWindowBounds(getViewport(), { wide: wideRef.current }));
    }

    let observer: ResizeObserver | null = null;
    let frame = 0;

    const attach = () => {
      const panel = panelRef.current;
      if (!panel) {
        frame = requestAnimationFrame(attach);
        return;
      }
      syncBounds();
      observer = new ResizeObserver(() => syncBounds());
      observer.observe(panel);
    };

    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [open, syncBounds]);

  useEffect(() => {
    if (!open) return;

    const onResize = () => syncBounds();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, syncBounds]);

  useEffect(() => {
    return () => {
      if (hitTopTimerRef.current) clearTimeout(hitTopTimerRef.current);
    };
  }, []);

  const finishInteraction = useCallback(
    (pointerId: number, snap: boolean) => {
      const drag = dragRef.current;
      const resize = resizeRef.current;

      if (drag && drag.pointerId === pointerId) {
        dragRef.current = null;
        setIsDragging(false);
        setBounds((prev) => {
          const next = applyBounds(prev, snap);
          return boundsEqual(prev, next) ? prev : next;
        });
        return;
      }

      if (resize && resize.pointerId === pointerId) {
        resizeRef.current = null;
        setIsResizing(false);
        setBounds((prev) => {
          const next = applyBounds(prev, snap);
          return boundsEqual(prev, next) ? prev : next;
        });
      }
    },
    [applyBounds]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && drag.pointerId === event.pointerId) {
        event.preventDefault();
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        const candidate = {
          ...drag.origin,
          x: drag.origin.x + dx,
          y: drag.origin.y + dy,
        };
        setBounds((prev) => {
          const next = applyBounds(candidate);
          return boundsEqual(prev, next) ? prev : next;
        });
        return;
      }

      const resize = resizeRef.current;
      if (resize && resize.pointerId === event.pointerId) {
        event.preventDefault();
        const dx = event.clientX - resize.startX;
        const dy = event.clientY - resize.startY;
        const raw = applyResizeDelta(resize.origin, resize.handle, { dx, dy });
        setBounds((prev) => {
          const next = applyBounds(raw);
          return boundsEqual(prev, next) ? prev : next;
        });
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      finishInteraction(event.pointerId, true);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [isDragging, isResizing, applyBounds, finishInteraction]);

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!interactive) return;
      if (event.button !== 0) return;
      if (isNoDragTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...boundsRef.current },
      };
      setIsDragging(true);
    },
    [interactive]
  );

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      finishInteraction(event.pointerId, true);
    },
    [finishInteraction]
  );

  const createResizeHandleProps = useCallback(
    (handle: ResizeHandle) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (!interactive) return;
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        resizeRef.current = {
          pointerId: event.pointerId,
          handle,
          startX: event.clientX,
          startY: event.clientY,
          origin: { ...boundsRef.current },
        };
        setIsResizing(true);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        finishInteraction(event.pointerId, true);
      },
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
        finishInteraction(event.pointerId, true);
      },
    }),
    [finishInteraction, interactive]
  );

  return {
    bounds,
    hitTopClamp,
    isDragging,
    isResizing,
    panelRef,
    dragHandleProps: {
      onPointerDown: onDragPointerDown,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    createResizeHandleProps,
  };
}
