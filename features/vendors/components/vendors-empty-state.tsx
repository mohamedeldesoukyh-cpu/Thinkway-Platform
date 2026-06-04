import { UsersIcon } from "lucide-react";

type VendorsEmptyStateProps = {
  hasFilters: boolean;
};

export function VendorsEmptyState({ hasFilters }: VendorsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
        <UsersIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-foreground">
          {hasFilters ? "No vendors match your filters" : "No vendors yet"}
        </p>
        <p className="max-w-sm text-[11px] leading-snug text-muted-foreground">
          {hasFilters
            ? "Adjust search or filters, or clear them to see all creators."
            : "Add creators and agencies to assign them to campaigns later."}
        </p>
      </div>
    </div>
  );
}
