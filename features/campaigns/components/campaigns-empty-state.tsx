type CampaignsEmptyStateProps = {
  hasSearch: boolean;
};

export function CampaignsEmptyState({ hasSearch }: CampaignsEmptyStateProps) {
  return (
    <div className="tw-empty">
      <b>{hasSearch ? "No campaigns match" : "No campaigns yet"}</b>
      <p>
        {hasSearch
          ? "Try a different search, clear the filter, or switch the view to All."
          : "Create your first campaign to plan budgets, timelines, and deliverables."}
      </p>
    </div>
  );
}
