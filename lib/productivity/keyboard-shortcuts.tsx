"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type ShortcutAction = {
  id: string;
  keys: string;
  label: string;
  group: string;
  handler: () => void;
  /** When true, only fires if no input/textarea is focused */
  global?: boolean;
};

type KeyboardShortcutsContextValue = {
  register: (action: ShortcutAction) => () => void;
  openHelp: () => void;
  setHelpOpen: (open: boolean) => void;
};

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue | null>(
  null
);

export function useKeyboardShortcuts() {
  const ctx = useContext(KeyboardShortcutsContext);
  if (!ctx) {
    throw new Error("useKeyboardShortcuts must be used within KeyboardShortcutsProvider");
  }
  return ctx;
}

export function useRegisterShortcut(action: ShortcutAction | null) {
  const ctx = useContext(KeyboardShortcutsContext);

  useEffect(() => {
    if (!action || !ctx) {
      if (action && process.env.NODE_ENV === "development") {
        console.warn(
          "[keyboard-shortcuts] useRegisterShortcut skipped — no KeyboardShortcutsProvider",
          { id: action.id }
        );
      }
      return;
    }
    return ctx.register(action);
  }, [action, ctx]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function matchShortcut(event: KeyboardEvent, keys: string): boolean {
  const parts = keys.toLowerCase().split("+").map((p) => p.trim());
  const needCtrl = parts.includes("ctrl") || parts.includes("control");
  const needAlt = parts.includes("alt");
  const needShift = parts.includes("shift");
  const keyPart = parts.filter(
    (p) => !["ctrl", "control", "alt", "shift"].includes(p)
  )[0];

  if (needCtrl !== (event.ctrlKey || event.metaKey)) return false;
  if (needAlt !== event.altKey) return false;
  if (needShift !== event.shiftKey) return false;
  if (!keyPart) return false;

  if (keyPart === "enter") return event.key === "Enter";
  if (keyPart === "esc" || keyPart === "escape") return event.key === "Escape";
  if (keyPart === "/") return event.key === "/" && !event.ctrlKey && !event.altKey;

  return event.key.toLowerCase() === keyPart;
}

type KeyboardShortcutsProviderProps = {
  children: React.ReactNode;
  onHelpOpenChange?: (open: boolean) => void;
  helpOpen?: boolean;
};

export function KeyboardShortcutsProvider({
  children,
  onHelpOpenChange,
  helpOpen = false,
}: KeyboardShortcutsProviderProps) {
  const router = useRouter();
  const actionsRef = useRef<Map<string, ShortcutAction>>(new Map());

  const register = useCallback((action: ShortcutAction) => {
    actionsRef.current.set(action.id, action);
    return () => {
      actionsRef.current.delete(action.id);
    };
  }, []);

  const openHelp = useCallback(() => {
    onHelpOpenChange?.(true);
  }, [onHelpOpenChange]);

  const setHelpOpen = useCallback(
    (open: boolean) => {
      onHelpOpenChange?.(open);
    },
    [onHelpOpenChange]
  );

  useEffect(() => {
    register({
      id: "nav-campaigns",
      keys: "c",
      label: "Open campaigns",
      group: "Navigation",
      global: true,
      handler: () => router.push("/campaigns"),
    });
    register({
      id: "nav-billing",
      keys: "i",
      label: "Open billing",
      group: "Navigation",
      global: true,
      handler: () => router.push("/billing"),
    });
    register({
      id: "nav-po-tracker",
      keys: "p",
      label: "Open PO tracker",
      group: "Navigation",
      global: true,
      handler: () => router.push("/finance/po-tracker"),
    });
    register({
      id: "nav-vendors",
      keys: "v",
      label: "Open vendors",
      group: "Navigation",
      global: true,
      handler: () => router.push("/vendors"),
    });
    register({
      id: "help-open",
      keys: "?",
      label: "Open keyboard shortcuts",
      group: "Help",
      global: true,
      handler: () => openHelp(),
    });
  }, [register, router, openHelp]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (helpOpen && event.key === "Escape") {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }

      const editable = isEditableTarget(event.target);

      for (const action of actionsRef.current.values()) {
        if (action.global && editable && !matchShortcut(event, "ctrl+s") && !matchShortcut(event, "ctrl+enter")) {
          if (action.keys.length === 1) continue;
        }
        if (!action.global && editable) continue;

        if (matchShortcut(event, action.keys)) {
          event.preventDefault();
          action.handler();
          return;
        }
      }

      if (matchShortcut(event, "ctrl+s")) {
        event.preventDefault();
        const form = document.querySelector<HTMLFormElement>("form[data-shortcut-save]");
        form?.requestSubmit();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, setHelpOpen]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{ register, openHelp, setHelpOpen }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export const GLOBAL_SHORTCUTS: Omit<ShortcutAction, "handler">[] = [
  { id: "nav-campaigns", keys: "C", label: "Open campaigns", group: "Navigation" },
  { id: "nav-billing", keys: "I", label: "Open billing", group: "Navigation" },
  { id: "nav-po-tracker", keys: "P", label: "Open PO tracker", group: "Navigation" },
  { id: "nav-vendors", keys: "V", label: "Open vendors", group: "Navigation" },
  { id: "help-open", keys: "?", label: "Keyboard shortcuts", group: "Help" },
  { id: "save", keys: "Ctrl+S", label: "Save active form", group: "Forms" },
  { id: "submit", keys: "Ctrl+Enter", label: "Confirm / submit", group: "Forms" },
  { id: "close", keys: "Esc", label: "Close modal", group: "General" },
];

export const ASSIGNMENT_SHORTCUTS: Omit<ShortcutAction, "handler">[] = [
  { id: "add-row", keys: "Alt+N", label: "Add deliverable row", group: "Assignment" },
  { id: "dup-row", keys: "Alt+D", label: "Duplicate deliverable row", group: "Assignment" },
  { id: "toggle-vat", keys: "Alt+V", label: "Toggle VAT exempt", group: "Assignment" },
  { id: "pricing-mode", keys: "Alt+M", label: "Switch pricing mode", group: "Assignment" },
];
