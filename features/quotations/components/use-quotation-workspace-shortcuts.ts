"use client";

import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";

type QuotationWorkspaceShortcutOptions = {
  enabled?: boolean;
  canManage: boolean;
  hasSelection: boolean;
  hasVisibleItems: boolean;
  onAddCreator: () => void;
  onFocusSearch: () => void;
  onToggleCalcMode: () => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onDuplicateSelected: () => void;
  onRemoveSelected: () => void;
  onPreview: () => void;
};

export function useQuotationWorkspaceShortcuts(options: QuotationWorkspaceShortcutOptions) {
  const canEdit = options.enabled !== false && options.canManage;
  const { hasSelection, hasVisibleItems } = options;

  useRegisterShortcut(
    canEdit
      ? {
          id: "quotation-add-creator",
          keys: "a",
          label: "Add creator",
          group: "Quotation",
          global: true,
          handler: options.onAddCreator,
        }
      : null
  );

  useRegisterShortcut({
    id: "quotation-focus-search",
    keys: "/",
    label: "Focus creator search",
    group: "Quotation",
    global: true,
    handler: options.onFocusSearch,
  });

  useRegisterShortcut(
    canEdit
      ? {
          id: "quotation-toggle-calc-mode",
          keys: "alt+m",
          label: "Switch calculation mode",
          group: "Quotation",
          global: true,
          handler: options.onToggleCalcMode,
        }
      : null
  );

  useRegisterShortcut({
    id: "quotation-preview",
    keys: "alt+p",
    label: "Open preview",
    group: "Quotation",
    global: true,
    handler: options.onPreview,
  });

  useRegisterShortcut(
    canEdit && hasVisibleItems
      ? {
          id: "quotation-select-all",
          keys: "ctrl+shift+a",
          label: "Select all visible creators",
          group: "Quotation",
          handler: options.onSelectAllVisible,
        }
      : null
  );

  useRegisterShortcut(
    hasSelection
      ? {
          id: "quotation-clear-selection",
          keys: "shift+esc",
          label: "Clear selection",
          group: "Quotation",
          global: true,
          handler: options.onClearSelection,
        }
      : null
  );

  useRegisterShortcut(
    canEdit && hasSelection
      ? {
          id: "quotation-duplicate",
          keys: "alt+d",
          label: "Duplicate selected",
          group: "Quotation",
          handler: options.onDuplicateSelected,
        }
      : null
  );

  useRegisterShortcut(
    canEdit && hasSelection
      ? {
          id: "quotation-remove",
          keys: "shift+delete",
          label: "Remove selected",
          group: "Quotation",
          handler: options.onRemoveSelected,
        }
      : null
  );
}
