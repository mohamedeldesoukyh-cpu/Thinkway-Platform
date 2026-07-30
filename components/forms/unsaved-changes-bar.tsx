"use client";

import { useEffect, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UnsavedChangesBarProps = {
  isDirty: boolean;
  isSaving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onReset?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  resetLabel?: string;
  /** When true, bind Ctrl/Cmd+S to save while dirty. */
  enableSaveShortcut?: boolean;
  /** When true, prompt before unload while dirty. */
  enableLeaveGuard?: boolean;
  status?: ReactNode;
  className?: string;
};

/**
 * Shared dirty/save chrome for inline-edit modules (D9).
 */
export function UnsavedChangesBar({
  isDirty,
  isSaving = false,
  onSave,
  onCancel,
  onReset,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  resetLabel = "Reset",
  enableSaveShortcut = true,
  enableLeaveGuard = true,
  status,
  className,
}: UnsavedChangesBarProps) {
  useEffect(() => {
    if (!enableSaveShortcut || !isDirty) return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (!isSaving) onSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableSaveShortcut, isDirty, isSaving, onSave]);

  useEffect(() => {
    if (!enableLeaveGuard || !isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enableLeaveGuard, isDirty]);

  if (!isDirty) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          className="size-2 shrink-0 rounded-full bg-amber-600"
          aria-hidden
        />
        {status ?? "Unsaved changes"}
      </div>
      <div className="ml-auto flex flex-wrap gap-2">
        {onReset ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            disabled={isSaving}
            onClick={onReset}
          >
            {resetLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={isSaving}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={isSaving}
          onClick={onSave}
        >
          {isSaving ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
