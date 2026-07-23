"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
};

type ConfirmActionContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmDelete: (description: string, title?: string) => Promise<boolean>;
};

const ConfirmActionContext = createContext<ConfirmActionContextValue | null>(null);

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const confirmDelete = useCallback(
    (description: string, title = "Delete this item?") =>
      confirm({
        title,
        description,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        variant: "destructive",
      }),
    [confirm]
  );

  function handleClose(accepted: boolean) {
    setOpen(false);
    resolveRef.current?.(accepted);
    resolveRef.current = null;
    setOptions(null);
  }

  return (
    <ConfirmActionContext.Provider value={{ confirm, confirmDelete }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose(false);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{options?.title ?? "Are you sure?"}</DialogTitle>
            <DialogDescription>{options?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant={options?.variant === "destructive" ? "destructive" : "default"}
              onClick={() => handleClose(true)}
            >
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmActionContext.Provider>
  );
}

export function useConfirmAction() {
  const ctx = useContext(ConfirmActionContext);
  if (!ctx) {
    throw new Error("useConfirmAction must be used within ConfirmActionProvider");
  }
  return ctx;
}

export function useConfirmDelete() {
  return useConfirmAction().confirmDelete;
}
