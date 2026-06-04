"use client";

import { HelpCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ASSIGNMENT_SHORTCUTS,
  GLOBAL_SHORTCUTS,
} from "@/lib/productivity/keyboard-shortcuts";
import { useMemo, useState } from "react";

type KeyboardHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KeyboardHelpDialog({ open, onOpenChange }: KeyboardHelpDialogProps) {
  const [query, setQuery] = useState("");
  const all = useMemo(
    () => [...GLOBAL_SHORTCUTS, ...ASSIGNMENT_SHORTCUTS],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.keys.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q)
    );
  }, [all, query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Keyboard shortcuts & help</DialogTitle>
          <DialogDescription>
            Operate Thinkway with keyboard-first workflows. Press ? anytime to open this guide.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <Input
            placeholder="Search shortcuts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {groups.map(([group, items]) => (
            <div key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </h3>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 rounded-xl px-2 py-1.5 text-sm"
                  >
                    <span>{item.label}</span>
                    <kbd className="rounded-md border bg-muted px-2 py-0.5 font-mono text-xs">
                      {item.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Workflow tips</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>Package pricing groups deliverables under one creator cost.</li>
              <li>Per-deliverable pricing supports row-level revenue, cost, and live dates.</li>
              <li>Operational GP and margin always exclude VAT.</li>
              <li>Use Browse creators for filtered discovery beyond typeahead search.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HelpMenuButton({
  onClick,
  floating = false,
}: {
  onClick: () => void;
  floating?: boolean;
}) {
  if (floating) {
    return (
      <Button
        type="button"
        variant="default"
        size="icon"
        onClick={onClick}
        className="size-11 rounded-full shadow-lg"
        title="Help & keyboard shortcuts"
        aria-label="Help and keyboard shortcuts"
      >
        <HelpCircleIcon className="size-5" />
      </Button>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <HelpCircleIcon data-icon="inline-start" />
      Help
    </Button>
  );
}
