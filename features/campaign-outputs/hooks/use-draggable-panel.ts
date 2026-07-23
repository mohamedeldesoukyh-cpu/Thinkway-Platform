"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Offset = { x: number; y: number };

const NO_DRAG_SELECTOR = "button, a, input, select, textarea, [data-no-drag]";
const SIDE_MARGIN = 8;

function isNoDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(NO_DRAG_SELECTOR));
}

function clampScalar(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

/**
 * Keeps a center-anchored panel inside the viewport.
 * Panel uses `left/top: 50%` + `translate(calc(-50% + x), calc(-50% + y))`.
 * Top edge clamps at y=0 so the header cannot slide above the browser chrome.
 */
export function clampPanelOffset(
  offset: Offset,
  panelWidth: number,
  panelHeight: number,
  sideMargin = SIDE_MARGIN
): { offset: Offset; hitTop: boolean } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const centerX = vw / 2 + offset.x;
  const centerY = vh / 2 + offset.y;

  let left = centerX - panelWidth / 2;
  let top = centerY - panelHeight / 2;

  const hitTopAttempt = top < 0;

  const maxLeft = Math.max(0, vw - panelWidth - sideMargin);
  const maxTop = Math.max(0, vh - panelHeight - sideMargin);

  left = clampScalar(left, sideMargin, maxLeft);
  top = clampScalar(top, 0, maxTop);

  const clampedCenterX = left + panelWidth / 2;
  const clampedCenterY = top + panelHeight / 2;

  return {
    offset: {
      x: clampedCenterX - vw / 2,
      y: clampedCenterY - vh / 2,
    },
    hitTop: hitTopAttempt && top === 0,
  };
}

function getPanelDimensions(panel: HTMLElement): { width: number; height: number } {
  const rect = panel.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Pointer-driven drag offset for floating preview panels.
 * Resets when `enabled` becomes false (panel closed).
 * Clamps to viewport so the header cannot slide under browser chrome.
 */
export function useDraggablePanel(enabled: boolean) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [hitTopClamp, setHitTopClamp] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const hitTopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const applyClampedOffset = useCallback((next: Offset): Offset => {
    const panel = panelRef.current;
    if (!panel) return next;

    const { width, height } = getPanelDimensions(panel);
    const { offset: clamped, hitTop } = clampPanelOffset(next, width, height);

    if (hitTop) {
      setHitTopClamp(true);
      if (hitTopTimerRef.current) clearTimeout(hitTopTimerRef.current);
      hitTopTimerRef.current = setTimeout(() => setHitTopClamp(false), 350);
    }

    return clamped;
  }, []);

  const syncBounds = useCallback(() => {
    if (dragRef.current) return;
    setOffset((prev) => applyClampedOffset(prev));
  }, [applyClampedOffset]);

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      setHitTopClamp(false);
      setIsDragging(false);
      dragRef.current = null;
      return;
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
  }, [enabled, syncBounds]);

  useEffect(() => {
    if (!enabled) return;

    const onResize = () => syncBounds();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, syncBounds]);

  useEffect(() => {
    return () => {
      if (hitTopTimerRef.current) clearTimeout(hitTopTimerRef.current);
    };
  }, []);

  const moveDrag = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = clientX - drag.startX;
      const dy = clientY - drag.startY;
      const next = { x: drag.originX + dx, y: drag.originY + dy };
      setOffset(applyClampedOffset(next));
    },
    [applyClampedOffset]
  );

  const finishDrag = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
      syncBounds();
    },
    [syncBounds]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      moveDrag(event.clientX, event.clientY);
    };

    const onPointerEnd = (event: PointerEvent) => {
      finishDrag(event.pointerId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [isDragging, moveDrag, finishDrag]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (isNoDragTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
    };
    setIsDragging(true);
  }, []);

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      finishDrag(event.pointerId);
    },
    [finishDrag]
  );

  return {
    offset,
    hitTopClamp,
    isDragging,
    panelRef,
    dragHandleProps: {
      onPointerDown,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
