import { headers } from "next/headers";
import { Suspense, type ReactNode } from "react";

import { EnvironmentConfigProvider } from "@/components/environment/environment-config";
import { getPublicDeploymentConfig } from "@/lib/deploy/deployment-environment";

async function EnvironmentChromeInner({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") || headerStore.get("host") || null;
  const config = getPublicDeploymentConfig(host);

  return (
    <EnvironmentConfigProvider
      value={{
        surface: config.surface,
        label: config.label,
        developmentAppUrl: config.developmentAppUrl,
        productionAppUrl: config.productionAppUrl,
      }}
    >
      {children}
    </EnvironmentConfigProvider>
  );
}

function EnvironmentChromeFallback({ children }: { children: ReactNode }) {
  const config = getPublicDeploymentConfig();
  return (
    <EnvironmentConfigProvider
      value={{
        surface: config.surface,
        label: config.label,
        developmentAppUrl: config.developmentAppUrl,
        productionAppUrl: config.productionAppUrl,
      }}
    >
      {children}
    </EnvironmentConfigProvider>
  );
}

/** Provides environment config app-wide without a full-width banner. */
export function EnvironmentChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<EnvironmentChromeFallback>{children}</EnvironmentChromeFallback>}>
      <EnvironmentChromeInner>{children}</EnvironmentChromeInner>
    </Suspense>
  );
}
