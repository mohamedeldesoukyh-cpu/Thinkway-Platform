import { notFound } from "next/navigation";

import { ClientWorkspaceApp } from "@/features/client-workspace/components/client-workspace-app";
import { ClientWorkspaceClosed } from "@/features/client-workspace/components/client-workspace-closed";
import { ClientWorkspaceExpiredGate } from "@/features/client-workspace/components/client-workspace-expired-gate";
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
  const resolved = resolveClientWorkspaceSection(section as ClientWorkspaceSectionId);
  if (!isRenderableClientWorkspaceSection(resolved, loaded.view.visibleSections)) {
    notFound();
  }
  return (
    <ClientWorkspaceExpiredGate
      expired={loaded.view.linkExpired}
      reviewId={loaded.view.review.id}
      token={token}
    >
      <ClientWorkspaceApp
        view={loaded.view}
        token={token}
        section={resolved}
      />
    </ClientWorkspaceExpiredGate>
  );
}
