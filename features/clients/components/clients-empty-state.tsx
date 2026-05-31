import { Building2Icon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type ClientsEmptyStateProps = {
  hasSearch: boolean;
};

export function ClientsEmptyState({ hasSearch }: ClientsEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Building2Icon className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {hasSearch ? "No clients match your search" : "No clients yet"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasSearch
              ? "Try a different search term or clear the filter to see all clients."
              : "Create your first client to start managing campaigns and deliverables."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
