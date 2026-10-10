import { EntranceGate } from "@/features/client-workspace/components/client-entrance-frame";
import { ClientWorkspaceAccessRequest } from "@/features/client-workspace/components/client-workspace-access-request";
import { ClientReviewEntry, InvalidReviewLink } from "@/features/client-workspace/components/client-review-entry";
import { loadClientWorkspace } from "@/features/client-workspace/load-client-workspace";
import { reviewIdBelongsToJourney } from "@/features/client-workspace/journey-state";
import { resolveReviewToken } from "@/features/client-workspace/security/resolve-request-token";
import { defaultClientWorkspaceSection } from "@/features/client-workspace/visible-sections";
export { generateReviewShareMetadata as generateMetadata } from "@/features/client-workspace/share-preview-server";
type Props = {
    params: Promise<{
        reviewId: string;
    }>;
    searchParams: Promise<{
        sign?: string;
    }>;
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
            return <EntranceGate title="This workspace is unavailable"><p>Please contact your Thinkway team for access.</p></EntranceGate>;
        }
        if (loaded.code === "workspace_unavailable") {
            return (<EntranceGate title="This workspace is unavailable"><p>Please contact your Thinkway team for access.</p></EntranceGate>);
        }
        return <InvalidReviewLink message={loaded.message}/>;
    }
    if (!reviewIdBelongsToJourney(reviewId, {
        canonicalReviewId: loaded.view.journey?.canonicalReviewId,
        memberReviewIds: loaded.view.journey?.memberReviewIds,
        activeReviewId: loaded.view.review.id,
        journeyId: loaded.view.journey?.id,
    })) {
        return <InvalidReviewLink />;
    }
    if (loaded.view.linkExpired) {
        return <EntranceGate><ClientWorkspaceAccessRequest reviewId={loaded.view.review.id} token={token}/></EntranceGate>;
    }
    return (<ClientReviewEntry entry={loaded.entry} reviewId={reviewId} token={token} landingSection={defaultClientWorkspaceSection(loaded.view.visibleSections)}/>);
}
