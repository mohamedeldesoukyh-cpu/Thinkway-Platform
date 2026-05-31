import { UsersIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type VendorsEmptyStateProps = {
  hasFilters: boolean;
};

export function VendorsEmptyState({ hasFilters }: VendorsEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <UsersIcon className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {hasFilters ? "No vendors match your filters" : "No vendors yet"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Adjust search or filters, or clear them to see all creators."
              : "Add creators and agencies to assign them to campaigns later."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
