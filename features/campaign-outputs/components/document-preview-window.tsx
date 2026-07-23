"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { FileTextIcon, Maximize2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  RESIZE_HANDLES,
  RESIZE_HANDLE_CURSORS,
  type DocumentWindowBounds,
  type ResizeHandle,
} from "../hooks/document-window-bounds";
import { DocumentPreviewWindowControls } from "./document-preview-window-controls";

/** App chrome reference z-indexes: sidebar/copilot/studio sticky z-50, dialogs z-[110]. */
export const DOCUMENT_PREVIEW_LAYER_Z = 9998;
export const DOCUMENT_PREVIEW_DIALOG_Z = 9999;

const PREVIEW_LAYER_Z = "z-[9998]";

const PREVIEW_PORTAL_ROOT_ID = "document-preview-portal-root";

function getPreviewPortalRoot(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("Document preview portal requires a browser document.");
  }

  let root = document.getElementById(PREVIEW_PORTAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PREVIEW_PORTAL_ROOT_ID;
    root.setAttribute("data-document-preview-portal", "");
    document.body.appendChild(root);
  }

  return root;
}

export type PreviewWindowState = "normal" | "maximized" | "minimized";

type DragHandleProps = {
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
};

const RESIZE_HANDLE_LAYOUT: Record<
  ResizeHandle,
  { className: string; "aria-label": string }
> = {
  n: { className: "top-0 left-3 right-3 h-1.5", "aria-label": "Resize top edge" },
  s: { className: "bottom-0 left-3 right-3 h-1.5", "aria-label": "Resize bottom edge" },
  e: { className: "right-0 top-3 bottom-3 w-1.5", "aria-label": "Resize right edge" },
  w: { className: "left-0 top-3 bottom-3 w-1.5", "aria-label": "Resize left edge" },
  ne: { className: "top-0 right-0 size-2.5", "aria-label": "Resize top-right corner" },
  nw: { className: "top-0 left-0 size-2.5", "aria-label": "Resize top-left corner" },
  se: { className: "bottom-0 right-0 size-2.5", "aria-label": "Resize bottom-right corner" },
  sw: { className: "bottom-0 left-0 size-2.5", "aria-label": "Resize bottom-left corner" },
};

export type DocumentPreviewWindowProps = {
  open: boolean;
  windowState: PreviewWindowState;
  onWindowStateChange: (state: PreviewWindowState) => void;
  onClose: () => void;
  /** Shown in the minimized dock bar. */
  title: string;
  subtitle?: string;
  isMediaPlan?: boolean;
  wide?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  windowBounds?: DocumentWindowBounds;
  dragHandleProps?: DragHandleProps;
  createResizeHandleProps?: (handle: ResizeHandle) => DragHandleProps;
  /** Ref for the floating panel shell (used for drag bounds + fullscreen). */
  panelRef?: Ref<HTMLDivElement>;
  /** True while the user is actively dragging — disables position transition. */
  isDragging?: boolean;
  /** True while the user is actively resizing — disables size transition. */
  isResizing?: boolean;
  /** Brief visual feedback when drag hits the top viewport clamp. */
  hitTopClamp?: boolean;
  header?: ReactNode;
  actions?: ReactNode;
  onHeaderDoubleClick?: () => void;
  onBackdropClick?: () => void;
  children: ReactNode;
};

/**
 * macOS-inspired document preview shell — normal modal, viewport-maximized, or
 * minimized dock bar with traffic-light window controls.
 */
export function DocumentPreviewWindow({
  open,
  windowState,
  onWindowStateChange,
  onClose,
  title,
  subtitle,
  isMediaPlan = false,
  wide = false,
  draggable = false,
  resizable = false,
  windowBounds,
  dragHandleProps,
  createResizeHandleProps,
  panelRef,
  isDragging = false,
  isResizing = false,
  hitTopClamp = false,
  header,
  actions,
  onHeaderDoubleClick,
  onBackdropClick,
  children,
}: DocumentPreviewWindowProps) {
  const isMaximized = windowState === "maximized";
  const isMinimized = windowState === "minimized";
  const isNormal = windowState === "normal";
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const internalPanelRef = useRef<HTMLDivElement>(null);

  const setPanelRef = (node: HTMLDivElement | null) => {
    internalPanelRef.current = node;
    if (!panelRef) return;
    if (typeof panelRef === "function") {
      panelRef(node);
    } else {
      panelRef.current = node;
    }
  };

  useEffect(() => {
    setPortalRoot(getPreviewPortalRoot());
  }, []);

  useEffect(() => {
    if (!open || windowState !== "maximized") {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = internalPanelRef.current;
    if (panel && typeof panel.requestFullscreen === "function") {
      void panel.requestFullscreen().catch(() => {
        // inset-0 fallback when fullscreen is blocked or unsupported
      });
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, [open, windowState]);

  if (!open || !portalRoot) return null;

  const handleMaximizeToggle = () => {
    onWindowStateChange(isMaximized ? "normal" : "maximized");
  };

  const handleMinimize = () => {
    onWindowStateChange("minimized");
  };

  if (isMinimized) {
    return createPortal(
      <div
        data-document-preview-layer
        className={cn("pointer-events-none fixed inset-0", PREVIEW_LAYER_Z)}
        style={{ zIndex: DOCUMENT_PREVIEW_LAYER_Z }}
      >
        <div
          className={cn(
            "pointer-events-auto fixed animate-in fade-in-0 slide-in-from-bottom-4 duration-200",
            "inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2"
          )}
        >
          <button
            type="button"
            onClick={() => onWindowStateChange("normal")}
            className={cn(
              "flex w-full items-center gap-3 border border-border bg-background/95 px-4 py-3 shadow-2xl backdrop-blur transition-colors hover:bg-muted/60",
              "sm:w-auto sm:min-w-[min(420px,92vw)] sm:rounded-full sm:px-5 sm:py-2.5",
              isMediaPlan && "border-[#1D9E75]/25"
            )}
            aria-label={`Restore ${title}`}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full sm:size-7",
                isMediaPlan
                  ? "bg-[#1D9E75]/10 text-[#1D9E75]"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <FileTextIcon className="size-4 sm:size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-semibold text-foreground">
                {title}
              </span>
              {subtitle ? (
                <span className="block truncate text-[11px] text-muted-foreground">
                  {subtitle}
                </span>
              ) : null}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              <Maximize2Icon className="size-3" aria-hidden />
              Restore
            </span>
          </button>
        </div>
      </div>,
      portalRoot
    );
  }

  return createPortal(
    <div
      data-document-preview-layer
      className={cn("pointer-events-none fixed inset-0", PREVIEW_LAYER_Z)}
      style={{ zIndex: DOCUMENT_PREVIEW_LAYER_Z }}
    >
      {isNormal ? (
        <div
          className="pointer-events-auto fixed inset-0 bg-black/30 transition-opacity duration-300"
          onClick={onBackdropClick}
          aria-hidden
        />
      ) : null}

      <div
        ref={setPanelRef}
        className={cn(
          "group/document-preview pointer-events-auto fixed flex flex-col overflow-hidden bg-background shadow-2xl duration-300 ease-in-out",
          isDragging || isResizing
            ? "transition-[border-radius,box-shadow]"
            : "transition-[left,top,width,height,border-radius,box-shadow]",
          isMaximized
            ? "inset-0 top-0 left-0 h-dvh w-dvw max-h-none rounded-none border-0"
            : cn(
                "rounded-xl border border-border",
                hitTopClamp && "shadow-[0_-4px_0_0_rgba(29,158,117,0.45)]"
              )
        )}
        style={
          isMaximized
            ? { top: 0, left: 0, right: 0, bottom: 0 }
            : windowBounds
              ? {
                  left: windowBounds.x,
                  top: windowBounds.y,
                  width: windowBounds.width,
                  height: windowBounds.height,
                }
              : {
                  left: "50%",
                  top: "50%",
                  width: wide ? "min(1280px, 98vw)" : "min(1120px, 96vw)",
                  height: "min(85vh, 880px)",
                  transform: "translate(-50%, -50%)",
                }
        }
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header
          data-drag-handle={draggable && isNormal ? "" : undefined}
          className={cn(
            "flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3",
            isMediaPlan
              ? "border-[#1D9E75]/20 bg-gradient-to-r from-[#1D9E75]/[0.06] via-background to-background"
              : "border-border bg-background/95",
            draggable &&
              isNormal &&
              "cursor-grab touch-none select-none active:cursor-grabbing"
          )}
          {...(draggable && isNormal && dragHandleProps ? dragHandleProps : {})}
          onDoubleClick={(event) => {
            if (event.target instanceof Element && event.target.closest("[data-no-drag]")) {
              return;
            }
            onHeaderDoubleClick?.();
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <DocumentPreviewWindowControls
              windowState={windowState}
              onClose={onClose}
              onMinimize={handleMinimize}
              onMaximizeToggle={handleMaximizeToggle}
            />
            <div className="min-w-0 flex-1">{header}</div>
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2" data-no-drag>
              {actions}
            </div>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {children}
        </div>

        {isNormal && resizable && createResizeHandleProps
          ? RESIZE_HANDLES.map((handle) => {
              const layout = RESIZE_HANDLE_LAYOUT[handle];
              return (
                <div
                  key={handle}
                  role="separator"
                  aria-orientation={
                    handle === "n" || handle === "s"
                      ? "horizontal"
                      : handle === "e" || handle === "w"
                        ? "vertical"
                        : undefined
                  }
                  aria-label={layout["aria-label"]}
                  className={cn(
                    "absolute z-10 touch-none opacity-0 transition-opacity",
                    "bg-[#1D9E75]/0 hover:bg-[#1D9E75]/35",
                    "group-hover/document-preview:opacity-100",
                    layout.className
                  )}
                  style={{ cursor: RESIZE_HANDLE_CURSORS[handle] }}
                  {...createResizeHandleProps(handle)}
                />
              );
            })
          : null}
      </div>
    </div>,
    portalRoot
  );
}
