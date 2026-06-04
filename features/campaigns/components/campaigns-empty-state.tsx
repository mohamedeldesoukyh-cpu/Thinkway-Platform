import { MegaphoneIcon } from "lucide-react";

type CampaignsEmptyStateProps = {
  hasSearch: boolean;
};

export function CampaignsEmptyState({ hasSearch }: CampaignsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
        <MegaphoneIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-foreground">
          {hasSearch ? "No campaigns match your search" : "No campaigns yet"}
        </p>
        <p className="max-w-sm text-[11px] leading-snug text-muted-foreground">
          {hasSearch
            ? "Try a different search term or clear the filter to see all campaigns."
            : "Create your first campaign to plan budgets, timelines, and deliverables."}
        </p>
      </div>
    </div>
  );
}
