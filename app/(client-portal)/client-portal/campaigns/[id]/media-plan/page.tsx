import { notFound } from "next/navigation";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientMediaPlanView } from "@/features/portals/components/client-media-plan-view";
import { loadClientMediaPlan } from "@/features/portals/queries/load-client-media-plan";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientPortalMediaPlanPage({ params }: Props) {
  const { id } = await params;
  const payload = await loadClientMediaPlan(id);

  if (!payload) {
    notFound();
  }

  return (
    <PlatformErrorBoundary surface="generic">
      <ClientMediaPlanView payload={payload} />
    </PlatformErrorBoundary>
  );
}
