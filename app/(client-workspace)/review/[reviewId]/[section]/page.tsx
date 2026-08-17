import { notFound } from "next/navigation";

import { ClientWorkspaceSectionView } from "@/features/client-workspace/components/client-workspace-section-view";
import { ClientWorkspaceShell } from "@/features/client-workspace/components/client-workspace-shell";
import { InvalidReviewLink } from "@/features/client-workspace/components/client-review-entry";
import { CLIENT_WORKSPACE_SECTIONS, type ClientWorkspaceSectionId } from "@/features/client-workspace/constants";
import { loadClientWorkspace } from "@/features/client-workspace/load-client-workspace";
import { resolveReviewToken } from "@/features/client-workspace/security/resolve-request-token";

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
  const loaded = await loadClientWorkspace(token);
  if (!loaded.ok || loaded.view.review.id !== reviewId) {
    return <InvalidReviewLink message={loaded.ok ? undefined : loaded.message} />;
  }
  if (!loaded.view.visibleSections.includes(section as ClientWorkspaceSectionId)) {
    notFound();
  }
  return (
    <ClientWorkspaceShell view={loaded.view} token={token}>
      <ClientWorkspaceSectionView
        section={section as ClientWorkspaceSectionId}
        view={loaded.view}
        token={token}
      />
    </ClientWorkspaceShell>
  );
}
