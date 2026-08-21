import { notFound } from "next/navigation";

import { ClientWorkspaceApp } from "@/features/client-workspace/components/client-workspace-app";
import { InvalidReviewLink } from "@/features/client-workspace/components/client-review-entry";
import { CLIENT_WORKSPACE_SECTIONS, type ClientWorkspaceSectionId } from "@/features/client-workspace/constants";
import { loadClientWorkspace } from "@/features/client-workspace/load-client-workspace";
import { reviewIdBelongsToJourney } from "@/features/client-workspace/journey-state";
import { resolveReviewToken } from "@/features/client-workspace/security/resolve-request-token";
import {
  isRenderableClientWorkspaceSection,
  resolveClientWorkspaceSection,
} from "@/features/client-workspace/visible-sections";

type Props = {
  params: Promise<{ reviewId: string; section: string }>;
  searchParams: Promise<{ sign?: string }>;
};

export default async function ClientWorkspaceSectionPage({ params, searchParams }: Props) {
  const { reviewId, section } = await params;
  if (!CLIENT_WORKSPACE_SECTIONS.includes(section as ClientWorkspaceSectionId)) {
    notFound();
  }
  const query = await searchParams;
  const token = await resolveReviewToken(reviewId, query.sign);
  if (!token) {
    return <InvalidReviewLink />;
  }
  const loaded = await loadClientWorkspace(token, reviewId);
  if (
    !loaded.ok ||
    !reviewIdBelongsToJourney(reviewId, {
      canonicalReviewId: loaded.view.journey?.canonicalReviewId,
      memberReviewIds: loaded.view.journey?.memberReviewIds,
      activeReviewId: loaded.view.review.id,
      journeyId: loaded.view.journey?.id,
    })
  ) {
    return <InvalidReviewLink message={loaded.ok ? undefined : loaded.message} />;
  }
  const resolved = resolveClientWorkspaceSection(section as ClientWorkspaceSectionId, {
    canOpenCommercial: loaded.view.visibleSections.includes("commercial"),
  });
  if (!isRenderableClientWorkspaceSection(resolved, loaded.view.visibleSections)) {
    notFound();
  }
  return (
    <ClientWorkspaceApp
      view={loaded.view}
      token={token}
      section={resolved}
    />
  );
}
