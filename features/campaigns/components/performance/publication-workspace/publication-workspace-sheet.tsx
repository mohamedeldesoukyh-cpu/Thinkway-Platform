import type { CSSProperties, ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { shouldPreventSheetOutsideDismiss } from "@/features/campaigns/components/performance/publication-workspace/publication-workspace-open-policy";
import { cn } from "@/lib/utils";

/** Enterprise publication workspace — wider than standard operational half-panel. */
export const PUBLICATION_WORKSPACE_SHEET_STYLE: CSSProperties = {
  width: "min(80vw, 1280px)",
  minWidth: "min(1100px, 100vw)",
  maxWidth: "1280px",
};

export const PUBLICATION_WORKSPACE_SHEET_CLASS = cn(
  "flex flex-col gap-0 overflow-hidden border-y border-l border-border/60 bg-card p-0",
  "transition-[width,max-width] duration-200 ease-out",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none rounded-l-[1.75rem] rounded-r-none shadow-[-12px_0_40px_-8px_rgba(0,0,0,0.12)]"
);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function PublicationWorkspaceSheet({ open, onOpenChange, title, description, children }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        showCloseButton
        showOverlay={false}
        style={PUBLICATION_WORKSPACE_SHEET_STYLE}
        className={PUBLICATION_WORKSPACE_SHEET_CLASS}
        onInteractOutside={(event) => {
          if (shouldPreventSheetOutsideDismiss(event.target)) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (shouldPreventSheetOutsideDismiss(event.target)) {
            event.preventDefault();
          }
        }}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {description ? <SheetDescription className="sr-only">{description}</SheetDescription> : null}
        {children}
      </SheetContent>
    </Sheet>
  );
}
