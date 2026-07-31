import { Suspense } from "react";

import { DashboardProviders } from "@/components/layout/dashboard-providers";
import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { DashboardSidebarAuth } from "@/components/layout/dashboard-sidebar-auth";
import { InternalWorkspaceGate } from "@/components/layout/internal-workspace-gate";
import { NavigationLoadingProvider } from "@/components/layout/navigation-loading-provider";

/**
 * Dashboard-only design systems (not loaded on login / portals):
 * - platform v6: lists, entity workspaces, KPI strips
 * - campaign workspace: operational tables, campaign/quotation/IO chrome
 */
import "@/app/thinkway-platform-v6.css";
import "@/app/styles/campaign-workspace.css";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <InternalWorkspaceGate>
      <DashboardProviders>
        <div className="relative flex h-full min-h-0 bg-background text-foreground">
          <div className="thinkway-platform-shell flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
            <Suspense
              fallback={<CollapsibleAppSidebar userEmail={null} />}
            >
              <DashboardSidebarAuth />
            </Suspense>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out">
              <Suspense fallback={null}>
                <NavigationLoadingProvider>{children}</NavigationLoadingProvider>
              </Suspense>
            </div>
          </div>
        </div>
      </DashboardProviders>
    </InternalWorkspaceGate>
  );
}
