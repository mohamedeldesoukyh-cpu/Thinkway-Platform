"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type Offset = { x: number; y: number };

const NO_DRAG_SELECTOR = "button, a, input, select, textarea, [data-no-drag]";

function isNoDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(NO_DRAG_SELECTOR));
}

/**
 * Pointer-driven drag offset for floating preview panels.
 * Resets when `enabled` becomes false (panel closed).
 */
export function useDraggablePanel(enabled: boolean) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) setOffset({ x: 0, y: 0 });
  }, [enabled]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (isNoDragTarget(event.target)) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
    },
    [offset.x, offset.y]
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setOffset({ x: drag.originX + dx, y: drag.originY + dy });
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return {
    offset,
    dragHandleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}
