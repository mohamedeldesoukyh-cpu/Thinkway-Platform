import { ClientReviewEntry, InvalidReviewLink } from "@/features/client-workspace/components/client-review-entry";
import { ClientWorkspaceClosed } from "@/features/client-workspace/components/client-workspace-closed";
import { loadClientWorkspace } from "@/features/client-workspace/load-client-workspace";
import { reviewIdBelongsToJourney } from "@/features/client-workspace/journey-state";
import { resolveReviewToken } from "@/features/client-workspace/security/resolve-request-token";
import { defaultClientWorkspaceSection } from "@/features/client-workspace/visible-sections";

type Props = {
  params: Promise<{ reviewId: string }>;
  searchParams: Promise<{ sign?: string }>;
};

export default async function ClientReviewEntryPage({ params, searchParams }: Props) {
  const { reviewId } = await params;
  const query = await searchParams;
  const token = await resolveReviewToken(reviewId, query.sign);
  if (!token) {
    return <InvalidReviewLink />;
  }
  const loaded = await loadClientWorkspace(token, reviewId);
  if (!loaded.ok) {
    if (loaded.code === "workspace_off") {
      return <ClientWorkspaceClosed />;
    }
    if (loaded.code === "workspace_unavailable") {
      return (
        <ClientWorkspaceClosed
          title="This workspace is unavailable"
          body="This review is not linked to a legal entity, so Client Workspace cannot open. Speak with your Thinkway team."
        />
      );
    }
    return <InvalidReviewLink message={loaded.message} />;
  }
  if (
    !reviewIdBelongsToJourney(reviewId, {
      canonicalReviewId: loaded.view.journey?.canonicalReviewId,
      memberReviewIds: loaded.view.journey?.memberReviewIds,
      activeReviewId: loaded.view.review.id,
      journeyId: loaded.view.journey?.id,
    })
  ) {
    return <InvalidReviewLink />;
  }
  return (
    <ClientReviewEntry
      entry={loaded.entry}
      reviewId={reviewId}
      token={token}
      landingSection={defaultClientWorkspaceSection(loaded.view.visibleSections)}
    />
  );
}

