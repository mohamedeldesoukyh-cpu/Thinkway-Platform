"use client";

import Link from "next/link";
import { ArrowLeftIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import { VendorKpiStrip } from "@/features/vendors/components/vendor-kpi-strip";
import { VendorStatusBadge } from "@/features/vendors/components/vendor-status-badge";
import { VendorActivityTab } from "@/features/vendors/components/tabs/vendor-activity-tab";
import { VendorAssignmentsTab } from "@/features/vendors/components/tabs/vendor-assignments-tab";
import { VendorBillingTab } from "@/features/vendors/components/tabs/vendor-billing-tab";
import { VendorContractsTab } from "@/features/vendors/components/tabs/vendor-contracts-tab";
import { VendorDocumentsTab } from "@/features/vendors/components/tabs/vendor-documents-tab";
import { VendorOverviewTab } from "@/features/vendors/components/tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "@/features/vendors/components/tabs/vendor-platforms-tab";
import type { VendorWorkspace } from "@/features/vendors/types";

type VendorWorkspaceViewProps = {
  workspace: VendorWorkspace;
  defaultTab?: string;
};

export function VendorWorkspaceView({
  workspace,
  defaultTab = "overview",
}: VendorWorkspaceViewProps) {
  const [depOpen, setDepOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/vendors">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to vendors
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              {workspace.display_name}
            </h2>
            <VendorStatusBadge status={workspace.status} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontalIcon className="size-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDepOpen(true)}>
                View dependencies
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/operations/move?vendor=${workspace.id}`}>
                  Reassign via Move
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {workspace.document_number}
          {workspace.country_code ? ` · ${workspace.country_code}` : null}
        </p>
      </div>

      <VendorKpiStrip workspace={workspace} />

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="billing">Billing & Payments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="activity">Activity & Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <VendorOverviewTab vendor={workspace} />
        </TabsContent>
        <TabsContent value="platforms">
          <VendorPlatformsTab vendor={workspace} />
        </TabsContent>
        <TabsContent value="assignments">
          <VendorAssignmentsTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="billing">
          <VendorBillingTab workspace={workspace} />
        </TabsContent>
        <TabsContent value="documents">
          <VendorDocumentsTab vendor={workspace} />
        </TabsContent>
        <TabsContent value="contracts">
          <VendorContractsTab vendor={workspace} />
        </TabsContent>
        <TabsContent value="activity">
          <VendorActivityTab workspace={workspace} />
        </TabsContent>
      </Tabs>

      <VendorDependencyDialog
        vendorId={workspace.id}
        vendorName={workspace.display_name}
        open={depOpen}
        onOpenChange={setDepOpen}
        onArchive={
          workspace.counts.assignments === 0 ? () => setDepOpen(false) : undefined
        }
      />
    </div>
  );
}
