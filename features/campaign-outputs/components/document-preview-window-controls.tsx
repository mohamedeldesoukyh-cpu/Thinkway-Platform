"use client";

import { MinusIcon, SquareIcon, XIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { PreviewWindowState } from "./document-preview-window";

type DocumentPreviewWindowControlsProps = {
  windowState: PreviewWindowState;
  onClose: () => void;
  onMinimize: () => void;
  onMaximizeToggle: () => void;
  className?: string;
};

const TRAFFIC_LIGHT_BASE =
  "group relative flex size-[13px] shrink-0 items-center justify-center rounded-full transition-[filter,transform] duration-150 hover:brightness-95 active:scale-95";

/**
 * macOS-style traffic light window controls for document preview panels.
 */
export function DocumentPreviewWindowControls({
  windowState,
  onClose,
  onMinimize,
  onMaximizeToggle,
  className,
}: DocumentPreviewWindowControlsProps) {
  const isMaximized = windowState === "maximized";

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center gap-2", className)} data-no-drag>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClose}
              className={cn(TRAFFIC_LIGHT_BASE, "bg-[#FF5F57]")}
              aria-label="Close preview"
            >
              <XIcon
                className="size-2 text-[#4d0000]/80 opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={3}
                aria-hidden
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onMinimize}
              className={cn(TRAFFIC_LIGHT_BASE, "bg-[#FFBD2E]")}
              aria-label="Minimize preview"
            >
              <MinusIcon
                className="size-2 text-[#5c4200]/80 opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={3}
                aria-hidden
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Minimize</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onMaximizeToggle}
              className={cn(TRAFFIC_LIGHT_BASE, "bg-[#28C840]")}
              aria-label={isMaximized ? "Restore preview size" : "Maximize preview"}
            >
              {isMaximized ? (
                <span
                  className="size-[7px] rounded-[1px] border border-[#004d00]/70 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              ) : (
                <SquareIcon
                  className="size-[9px] text-[#004d00]/80 opacity-0 transition-opacity group-hover:opacity-100"
                  strokeWidth={2.5}
                  aria-hidden
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isMaximized ? "Restore" : "Maximize"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
