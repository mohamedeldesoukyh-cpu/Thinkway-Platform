"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { DeploymentSurface } from "@/lib/deploy/deployment-environment";

export type PublicEnvironmentConfig = {
  surface: DeploymentSurface;
  label: string;
  developmentAppUrl: string;
  productionAppUrl: string;
};

const EnvironmentConfigContext = createContext<PublicEnvironmentConfig | null>(null);

export function EnvironmentConfigProvider({
  value,
  children,
}: {
  value: PublicEnvironmentConfig;
  children: ReactNode;
}) {
  return (
    <EnvironmentConfigContext.Provider value={value}>
      {children}
    </EnvironmentConfigContext.Provider>
  );
}

export function useEnvironmentConfig(): PublicEnvironmentConfig | null {
  return useContext(EnvironmentConfigContext);
}
