"use client";

import type { ComponentProps } from "react";

import { TabsContent } from "@/components/ui/tabs";
import { OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS } from "@/components/workspace/operational-workspace-ui";
import {
  EnterpriseSortableTabsBar,
  type EnterpriseTabItem,
} from "@/components/workspace/enterprise-tabs";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import { cn } from "@/lib/utils";

export type CampaignWorkspaceTabDef = EnterpriseTabItem;

type CampaignWorkspaceSortableTabsBarProps = {
  tabOrder: readonly CampaignWorkspaceTabId[];
  tabsById: Record<CampaignWorkspaceTabId, CampaignWorkspaceTabDef>;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

/** Campaign workspace tab rail — Aurora skin via Enterprise Tabs underline variant. */
export function CampaignWorkspaceSortableTabsBar({
  tabOrder,
  tabsById,
  onReorder,
}: CampaignWorkspaceSortableTabsBarProps) {
  return (
    <EnterpriseSortableTabsBar
      variant="underline"
      overflow="scroll"
      tabOrder={tabOrder}
      tabsById={tabsById}
      onReorder={onReorder}
      className="thinkway-aurora-panel-tabs px-3 pt-1.5"
      aria-label="Campaign process navigation"
    />
  );
}

/** @deprecated Prefer EnterpriseSortableTabsBar / CampaignWorkspaceSortableTabsBar */
export function CampaignWorkspaceTabsBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

/** Keeps tab panels mounted so deferred bundles stay warm and tab state survives switches. */
export function CampaignWorkspaceTabContent({
  className,
  ...props
}: ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent
      forceMount
      className={cn(
        OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
        "thinkway-campaign-tab-panel mt-0 outline-none focus-visible:outline-none",
        className
      )}
      {...props}
    />
  );
}

/** Tab body surface — reference content padding. */
export function CampaignWorkspaceTabPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("thinkway-campaign-content min-w-0", className)}>
      {children}
    </div>
  );
}
