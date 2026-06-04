"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { VendorIoRow } from "@/features/io/types";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";

type VendorIoRowContextMenuProps = {
  row: VendorIoRow;
  children: ReactNode;
};

export function VendorIoRowContextMenu({ row, children }: VendorIoRowContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const handleContextMenu = useCallback((event: MouseEvent<HTMLTableRowElement>) => {
    event.preventDefault();
    setPosition({ x: event.clientX, y: event.clientY });
    setOpen(true);
  }, []);

  if (!isValidElement(children)) {
    return children;
  }

  const rowElement = children as ReactElement<{ onContextMenu?: (event: MouseEvent<HTMLTableRowElement>) => void }>;

  const menuPortal =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={close} aria-hidden />
            <div
              role="menu"
              className="fixed z-50 min-w-[11rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ top: position.y, left: position.x }}
            >
              <VendorIoUngenerateTrigger
                row={row}
                variant="menu"
                disabled={!row.ungenerate_eligible}
                title={row.ungenerate_ineligible_reason ?? undefined}
                onBeforeOpen={close}
              />
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      {cloneElement(rowElement, {
        onContextMenu: (event: MouseEvent<HTMLTableRowElement>) => {
          rowElement.props.onContextMenu?.(event);
          handleContextMenu(event);
        },
      })}
      {menuPortal}
    </>
  );
}
