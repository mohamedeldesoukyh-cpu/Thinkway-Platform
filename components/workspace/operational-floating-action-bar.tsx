"use client";

import type { ReactNode } from "react";

import {
  FLOATING_ACTION_BAR_OFFSET,
  PLATFORM_FLOATING_BAR_CONTENT_CLASS,
  PlatformFloatingBarShell,
  platformFloatingBarContentClass,
} from "@/components/shared/navigation/platform-floating-action-bar";

export { FLOATING_ACTION_BAR_OFFSET };

/** @deprecated Use PLATFORM_FLOATING_BAR_CONTENT_CLASS */
export const OPERATIONAL_FLOATING_BAR_CONTENT_CLASS = PLATFORM_FLOATING_BAR_CONTENT_CLASS;

/** @deprecated Use platformFloatingBarContentClass */
export const operationalFloatingBarContentClass = platformFloatingBarContentClass;

export type OperationalFloatingActionBarProps = {
  /** When false, the bar animates out and ignores pointer events. */
  visible: boolean;
  children: ReactNode;
  /** Optional messages rendered below the pill (coverage warnings, etc.). */
  messages?: ReactNode;
  className?: string;
};

/**
 * Floating pill shell for custom operational bulk actions.
 * Prefer {@link PlatformFloatingActionBar} for standard selection + action patterns.
 */
export function OperationalFloatingActionBar({
  visible,
  children,
  messages,
  className,
}: OperationalFloatingActionBarProps) {
  return (
    <PlatformFloatingBarShell visible={visible} messages={messages} className={className}>
      {children}
    </PlatformFloatingBarShell>
  );
}

export {
  PlatformFloatingBarDivider,
  PlatformFloatingBarOverflowMenu,
  PlatformFloatingBarPrimaryButton,
  PlatformFloatingBarSecondaryLink,
  PlatformFloatingBarSelection,
  PLATFORM_FLOATING_BAR_PRIMARY_CLASS,
} from "@/components/shared/navigation/platform-floating-action-bar";
