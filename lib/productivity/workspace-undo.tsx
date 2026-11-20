"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { toast } from "sonner";
import { WorkspaceHistory, type UndoCommand } from "./workspace-history";

const HistoryContext = createContext<{
  record: (command: UndoCommand) => void;
  remove: (owner: string) => void;
  clear: () => void;
  beforeReplay: (flush: () => void) => () => void;
} | null>(null);

export function WorkspaceUndoProvider({ children }: { children: ReactNode }) {
  const history = useRef(new WorkspaceHistory());
  const flushes = useRef(new Set<() => void>());
  const value = useMemo(() => ({
    record: (command: UndoCommand) => history.current.record(command),
    remove: (owner: string) => history.current.remove(owner),
    clear: () => history.current.clear(),
    beforeReplay: (flush: () => void) => { flushes.current.add(flush); return () => { flushes.current.delete(flush); }; },
  }), []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const target = event.target;
      // Preserve the browser's text editing history. Number/select/checkbox controls use workspace history.
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('textarea, [role="textbox"]') || (target instanceof HTMLInputElement && !['number', 'checkbox', 'radio', 'range', 'date'].includes(target.type)))) return;
      for (const flush of flushes.current) flush();
      const direction = event.shiftKey || key === 'y' ? 'redo' : 'undo';
      if (history.current.step(direction)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toast.success(direction === 'undo' ? 'Edit undone' : 'Edit redone', { id: 'workspace-undo', duration: 1200 });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>;
}

export function useWorkspaceUndo() { return useContext(HistoryContext); }

/** The third setter resets from a server snapshot without creating an edit. */
export function useUndoableState<T>(initial: T | (() => T), label: string, enabled = true): [T, Dispatch<SetStateAction<T>>, Dispatch<SetStateAction<T>>] {
  const history = useWorkspaceUndo();
  const owner = useId();
  const [value, setValue] = useState(initial);
  const current = useRef(value);
  const enabledRef = useRef(enabled);
  useLayoutEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) history?.remove(owner);
  }, [enabled, history, owner]);
  const apply = useCallback((next: T) => { current.current = next; setValue(next); }, []);
  const edit = useCallback<Dispatch<SetStateAction<T>>>((update) => {
    const before = current.current;
    const after = typeof update === 'function' ? (update as (prev: T) => T)(before) : update;
    if (Object.is(before, after)) return;
    if (enabledRef.current) history?.record({ owner, label, undo: () => apply(before), redo: () => apply(after), available: () => enabledRef.current });
    apply(after);
  }, [apply, history, label, owner]);
  const reset = useCallback<Dispatch<SetStateAction<T>>>((update) => {
    history?.remove(owner);
    apply(typeof update === 'function' ? (update as (prev: T) => T)(current.current) : update);
  }, [apply, history, owner]);
  useEffect(() => () => history?.remove(owner), [history, owner]);
  return [value, edit, reset];
}
