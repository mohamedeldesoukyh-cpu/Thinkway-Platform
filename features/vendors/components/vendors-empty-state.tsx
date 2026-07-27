import { UsersIcon } from "lucide-react";

type VendorsEmptyStateProps = {
  hasFilters: boolean;
  crmOnly?: boolean;
};

export function VendorsEmptyState({
  hasFilters,
  crmOnly = true,
}: VendorsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
        <UsersIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-foreground">
          {hasFilters
            ? "No creators match your filters"
            : crmOnly
              ? "No commercial creators yet"
              : "No creators yet"}
        </p>
        <p className="max-w-sm text-[11px] leading-snug text-muted-foreground">
          {hasFilters
            ? "Adjust search or filters, or clear them to see all commercial creators."
            : crmOnly
              ? "Use New Creator or From Discovery to add a creator to Commercial CRM. Discovery identities stay out of CRM until you decide."
              : "Add creators and agencies to assign them to campaigns later."}
        </p>
      </div>
    </div>
  );
}
