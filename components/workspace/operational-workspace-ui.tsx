"use client";

import type { ComponentProps, ReactNode } from "react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OPERATIONAL_CHROME_META, OPERATIONAL_CHROME_TITLE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  DETAIL_FIELD_LABEL_CLASS,
  DetailSheetFooter,
} from "@/features/campaigns/components/operational-detail-panel";
import { TabsContent } from "@/components/ui/tabs";
import {
  EnterpriseSortableTabsBar,
  EnterpriseTabTrigger,
  EnterpriseTabsList,
  type EnterpriseTabItem,
} from "@/components/workspace/enterprise-tabs";
import { cn } from "@/lib/utils";

/** Tab body visibility — matches campaign workspace. */
export const OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS =
  "mt-4 flex-none outline-none focus-visible:outline-none data-[state=inactive]:hidden";

/** Keeps tab panels mounted so form state survives tab switches. */
export function OperationalWorkspaceTabContent({
  className,
  ...props
}: ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent
      forceMount
      className={cn(OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS, className)}
      {...props}
    />
  );
}

export type OperationalWorkspaceTabDef = EnterpriseTabItem;

/** @deprecated Use EnterpriseTabTrigger — kept for compatibility. */
export const OperationalWorkspaceTabTrigger = EnterpriseTabTrigger;

export function OperationalWorkspaceTabsBar({
  sectionLabel,
  children,
}: {
  sectionLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-t-xl bg-muted/40 px-2 pt-2" data-sticky="operational-workspace-tabs">
      {sectionLabel ? (
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
          {sectionLabel}
        </p>
      ) : null}
      <EnterpriseTabsList variant="pill" overflow="scroll" aria-label="Workspace tabs">
        {children}
      </EnterpriseTabsList>
    </div>
  );
}

type OperationalWorkspaceSortableTabsBarProps<T extends string> = {
  sectionLabel?: string;
  tabOrder: readonly T[];
  tabsById: Record<T, OperationalWorkspaceTabDef>;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

/** Drag-to-reorder tab rail — Enterprise Tabs (pill variant). */
export function OperationalWorkspaceSortableTabsBar<T extends string>({
  sectionLabel,
  tabOrder,
  tabsById,
  onReorder,
}: OperationalWorkspaceSortableTabsBarProps<T>) {
  return (
    <div className="rounded-t-xl bg-muted/40 px-2 pt-2" data-sticky="operational-workspace-tabs">
      {sectionLabel ? (
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
          {sectionLabel}
        </p>
      ) : null}
      <EnterpriseSortableTabsBar
        variant="pill"
        overflow="scroll"
        tabOrder={tabOrder}
        tabsById={tabsById}
        onReorder={onReorder}
        aria-label="Workspace tabs"
      />
    </div>
  );
}

export function OperationalWorkspaceTabPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 bg-background", className)}>{children}</div>;
}

/** Read-only label/value row — matches assignment detail field rhythm. */
export function OperationalDetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-3.5 last:border-b-0">
      <span className={DETAIL_FIELD_LABEL_CLASS}>{label}</span>
      <div className={cn("min-w-0 text-right text-sm text-foreground", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

/** Form / overview card shell — operational section header + body (+ optional footer). */
export function OperationalFormSection({
  title,
  description,
  actions,
  children,
  footer,
  footerHint,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  footerHint?: string;
  className?: string;
}) {
  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      className={className}
      leading={
        <CampaignOperationalSectionHeader
          title={title}
          description={description}
          actions={actions}
        />
      }
    >
      <div className="space-y-4 px-6 py-4">{children}</div>
      {footer ? <DetailSheetFooter hint={footerHint}>{footer}</DetailSheetFooter> : null}
    </OperationalTableSection>
  );
}

export function OperationalWorkspaceChrome({
  title,
  meta,
  badges,
  backButton,
}: {
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  backButton?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {backButton}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className={cn(OPERATIONAL_CHROME_TITLE, "truncate")}>{title}</h1>
          {badges}
        </div>
      </div>
      {meta ? <p className={cn(OPERATIONAL_CHROME_META, backButton ? "pl-10" : undefined)}>{meta}</p> : null}
    </div>
  );
}
