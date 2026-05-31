import { MegaphoneIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type CampaignsEmptyStateProps = {
  hasSearch: boolean;
};

export function CampaignsEmptyState({ hasSearch }: CampaignsEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <MegaphoneIcon className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {hasSearch ? "No campaigns match your search" : "No campaigns yet"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasSearch
              ? "Try a different search term or clear the filter to see all campaigns."
              : "Create your first campaign to plan budgets, timelines, and deliverables."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
