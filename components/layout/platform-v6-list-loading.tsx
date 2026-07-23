import type { ReactNode } from "react";

import { PlatformV6Page } from "@/components/platform/platform-v6-layout";

type PlatformV6ListLoadingProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function PlatformV6ListLoading({
  title,
  description,
  children,
}: PlatformV6ListLoadingProps) {
  return (
    <PlatformV6Page>
      <div className="platform-v6-page-header-row">
        <div className="platform-v6-page-header">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </PlatformV6Page>
  );
}
