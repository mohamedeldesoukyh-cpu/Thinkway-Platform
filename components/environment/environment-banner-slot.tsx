import { headers } from "next/headers";
import { Suspense } from "react";

import { EnvironmentBanner } from "@/components/environment/environment-banner";
import { getPublicDeploymentConfig } from "@/lib/deploy/deployment-environment";

async function EnvironmentBannerInner() {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") || headerStore.get("host") || null;
  const config = getPublicDeploymentConfig(host);

  return (
    <EnvironmentBanner
      surface={config.surface}
      label={config.label}
      developmentAppUrl={config.developmentAppUrl}
      productionAppUrl={config.productionAppUrl}
    />
  );
}

function EnvironmentBannerFallback() {
  const config = getPublicDeploymentConfig();
  return (
    <div
      role="status"
      className="relative z-[100] flex min-h-9 w-full shrink-0 items-center border-b border-slate-500/30 bg-slate-600 px-3 py-1.5 text-xs font-medium text-white"
    >
      <span className="uppercase tracking-wide">{config.label}</span>
    </div>
  );
}

export function EnvironmentBannerSlot() {
  return (
    <Suspense fallback={<EnvironmentBannerFallback />}>
      <EnvironmentBannerInner />
    </Suspense>
  );
}
