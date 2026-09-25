/** Resolve shortcuts from the visible UI, never from a hidden tab or background dialog. */
export function isShortcutVisible(element: Element): boolean {
  return !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
}

export function shortcutOverlay(): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')).filter(isShortcutVisible).at(-1);
}

export function isSaveLabel(label: string): boolean {
  return !/\b(send|publish|approve|export|delete)\b/i.test(label) &&
    /^(save(?:\s|$)|record (?:client |advance |vat )?payment\b)/i.test(label.trim());
}

function buttons(scope: ParentNode): HTMLButtonElement[] {
  return Array.from(scope.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]')).filter(isShortcutVisible);
}

function saveButtons(scope: ParentNode): HTMLButtonElement[] {
  return buttons(scope).filter(button => button.hasAttribute("data-shortcut-save-button") ||
    isSaveLabel(button.getAttribute("aria-label") ?? button.textContent ?? ""));
}

export function shortcutDisabled(button: HTMLButtonElement): boolean {
  return button.matches(':disabled, [aria-disabled="true"]') || Boolean(button.closest('[aria-busy="true"]'));
}

export type SaveTarget = { button?: HTMLButtonElement; scoped: boolean; ambiguous: boolean };

function chooseSave(candidates: HTMLButtonElement[], scoped: boolean): SaveTarget {
  const primary = candidates.filter(button => !/save draft/i.test(button.textContent ?? ""));
  if (primary.length) candidates = primary;
  const enabled = candidates.filter(button => !shortcutDisabled(button));
  if (enabled.length) candidates = enabled;
  return { button: candidates.length === 1 ? candidates[0] : undefined, scoped, ambiguous: candidates.length > 1 };
}

export function resolveSaveTarget(): SaveTarget {
  const active = document.activeElement;
  const overlay = shortcutOverlay();
  const pane = Array.from(document.querySelectorAll<HTMLElement>('[data-shortcut-pane]')).filter(isShortcutVisible).at(-1);
  const scope = overlay ?? pane;
  // External form-associated inputs (inline payment editing) also identify their form.
  const form = active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement || active instanceof HTMLButtonElement
    ? active.form : active?.closest('form');
  let candidates: HTMLButtonElement[];
  if (form && (!scope || scope.contains(active))) {
    candidates = buttons(document).filter(button => button.form === form &&
      (button.type === "submit" || isSaveLabel(button.getAttribute("aria-label") ?? button.textContent ?? "")));
    // Never use a destructive/approval submit as the implicit Save action.
    candidates = candidates.filter(button => button.hasAttribute("data-shortcut-save-button") ||
      isSaveLabel(button.getAttribute("aria-label") ?? button.textContent ?? ""));
    if (candidates.length) return chooseSave(candidates, true);
  }
  candidates = saveButtons(scope ?? document);
  // Prefer actual saves over optional Save draft controls.
  return chooseSave(candidates, Boolean(scope || form));
}

export function closeShortcutPane(): boolean {
  if (shortcutOverlay() || Array.from(document.querySelectorAll('[role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]')).some(isShortcutVisible)) return false;
  const pane = Array.from(document.querySelectorAll<HTMLElement>('[data-shortcut-pane]')).filter(isShortcutVisible).at(-1);
  const close = pane?.querySelector<HTMLButtonElement>('[data-shortcut-close]');
  if (!close) return false;
  if (!shortcutDisabled(close)) close.click();
  return true;
}

export function focusShortcutSearch(): void {
  const scope = shortcutOverlay() ?? document.querySelector('main') ?? document;
  const search = Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="search"], input[placeholder], input[aria-label]'))
    .find(input => isShortcutVisible(input) && !input.disabled && /search|find/i.test(`${input.placeholder} ${input.getAttribute('aria-label') ?? ''}`));
  search?.focus();
}
