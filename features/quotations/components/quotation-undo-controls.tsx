"use client";
import { useSyncExternalStore } from "react";
import { Undo2Icon, Redo2Icon } from "lucide-react";
import { useWorkspaceUndo } from "@/lib/productivity/workspace-undo";
const subscribe = () => () => {};
const empty = () => "0:0";
export function QuotationUndoControls({ disabled }: { disabled: boolean }) {
  const history = useWorkspaceUndo();
  const snapshot = useSyncExternalStore(history?.subscribe ?? subscribe, history?.snapshot ?? empty, empty);
  const [past, future] = snapshot.split(":").map(Number);
  return <><button type="button" className="b b--icon" title="Undo unsaved edit (Ctrl+Z)" aria-label="Undo unsaved edit" disabled={disabled || !past} onClick={() => history?.step("undo")}><Undo2Icon size={14} /></button>
    <button type="button" className="b b--icon" title="Redo unsaved edit (Ctrl+Shift+Z)" aria-label="Redo unsaved edit" disabled={disabled || !future} onClick={() => history?.step("redo")}><Redo2Icon size={14} /></button></>;
}
