"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { VendorDetail } from "@/types/database";

import { VendorStatusBadge } from "./vendor-status-badge";
import { VendorCampaignsTab } from "./tabs/vendor-campaigns-tab";
import { VendorDocumentsTab } from "./tabs/vendor-documents-tab";
import { VendorFinanceTab } from "./tabs/vendor-finance-tab";
import { VendorLegalTab } from "./tabs/vendor-legal-tab";
import { VendorOverviewTab } from "./tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "./tabs/vendor-platforms-tab";

type VendorProfileProps = {
  vendor: VendorDetail;
};

export function VendorProfile({ vendor }: VendorProfileProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/vendors">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to vendors
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {vendor.display_name}
          </h2>
          <VendorStatusBadge status={vendor.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <DocumentNumber value={vendor.document_number} />
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="campaigns">Campaign History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <VendorOverviewTab vendor={vendor} />
        </TabsContent>
        <TabsContent value="legal">
          <VendorLegalTab vendor={vendor} />
        </TabsContent>
        <TabsContent value="finance">
          <VendorFinanceTab vendor={vendor} />
        </TabsContent>
        <TabsContent value="documents">
          <VendorDocumentsTab vendor={vendor} />
        </TabsContent>
        <TabsContent value="platforms">
          <VendorPlatformsTab vendor={vendor} />
        </TabsContent>
        <TabsContent value="campaigns">
          <VendorCampaignsTab vendor={vendor} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
