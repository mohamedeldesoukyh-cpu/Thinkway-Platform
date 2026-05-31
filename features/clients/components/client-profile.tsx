"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientDetail } from "@/types/database";

import { ClientStatusBadge } from "./client-status-badge";
import { ClientBrandsTab } from "./tabs/client-brands-tab";
import { ClientCampaignsTab } from "./tabs/client-campaigns-tab";
import { ClientDocumentsTab } from "./tabs/client-documents-tab";
import { ClientFinanceTab } from "./tabs/client-finance-tab";
import { ClientLegalTab } from "./tabs/client-legal-tab";
import { ClientOverviewTab } from "./tabs/client-overview-tab";

type ClientProfileProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
  masterData: MasterDataOptions;
};

export function ClientProfile({ client, groups, masterData }: ClientProfileProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/clients">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to clients
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {client.name}
          </h2>
          <ClientStatusBadge status={client.status} />
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          {client.document_number}
          {client.group ? ` · ${client.group.name}` : null}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="campaigns">Campaign History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ClientOverviewTab client={client} groups={groups} />
        </TabsContent>
        <TabsContent value="brands">
          <ClientBrandsTab client={client} masterData={masterData} />
        </TabsContent>
        <TabsContent value="legal">
          <ClientLegalTab client={client} />
        </TabsContent>
        <TabsContent value="finance">
          <ClientFinanceTab client={client} />
        </TabsContent>
        <TabsContent value="documents">
          <ClientDocumentsTab client={client} />
        </TabsContent>
        <TabsContent value="campaigns">
          <ClientCampaignsTab client={client} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
