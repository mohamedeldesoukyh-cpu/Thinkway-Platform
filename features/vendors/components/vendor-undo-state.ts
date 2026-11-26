"use client";
import { useUndoableState } from '@/lib/productivity/workspace-undo';
export function useVendorUndoState<T>(initial:T|(()=>T)) {
  const [value,setValue]=useUndoableState(initial,'Creator details');
  return [value,setValue] as const;
}
