import { ClientReviewEntry } from "@/features/client-workspace/components/client-review-entry";
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
    return <InvalidLink />;
  }
  const loaded = await loadClientWorkspace(token);
  if (!loaded.ok || loaded.view.review.id !== reviewId) {
    return <InvalidLink message={loaded.ok ? undefined : loaded.message} />;
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

function InvalidLink({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-4">
      <div className="max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">This review link is not available</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {message ?? "The link may have been revoked or is for a different campaign."}
        </p>
      </div>
    </div>
  );
}
