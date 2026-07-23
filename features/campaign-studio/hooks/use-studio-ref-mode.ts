"use client";

import { createContext, createElement, useContext, type ReactNode } from "react";

const StudioRefModeContext = createContext(false);

export function StudioRefModeProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return createElement(StudioRefModeContext.Provider, { value: enabled }, children);
}

export function useStudioRefMode(): boolean {
  return useContext(StudioRefModeContext);
}

/** Pick reference CSS class or legacy Tailwind bundle. */
export function useStudioStyle(refClass: string, legacyClass: string): string {
  return useStudioRefMode() ? refClass : legacyClass;
}
