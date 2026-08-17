import { ClientReviewEntry, InvalidReviewLink } from "@/features/client-workspace/components/client-review-entry";
import { loadClientWorkspace } from "@/features/client-workspace/load-client-workspace";
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
  const loaded = await loadClientWorkspace(token);
  if (!loaded.ok || loaded.view.review.id !== reviewId) {
    return <InvalidReviewLink message={loaded.ok ? undefined : loaded.message} />;
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

