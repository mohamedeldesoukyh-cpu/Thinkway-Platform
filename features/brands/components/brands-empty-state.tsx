import Link from "next/link";
import { SparklesIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type BrandsEmptyStateProps = {
  hasSearch: boolean;
  hasClients: boolean;
};

export function BrandsEmptyState({ hasSearch, hasClients }: BrandsEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <SparklesIcon className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {hasSearch
              ? "No brands match your search"
              : hasClients
                ? "No brands yet"
                : "Create a client first"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasSearch ? (
              "Try a different search term or clear the filter to see all brands."
            ) : hasClients ? (
              "Add your first brand and link it to a client for campaign creation."
            ) : (
              <>
                Brands belong to clients.{" "}
                <Link href="/clients" className="underline hover:text-primary">
                  Create a client
                </Link>{" "}
                before adding brands.
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
