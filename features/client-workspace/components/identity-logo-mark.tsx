import type { IdentityLogo } from "@/lib/entity-logos/identity-logo";

import { LogoMark } from "./review-icons";

export function ClientWorkspaceIdentityMark({
  identityLogo,
  wordmarkAsSpan = false,
}: {
  identityLogo?: IdentityLogo | null;
  wordmarkAsSpan?: boolean;
}) {
  return (
    <div className="logo-pair">
      {identityLogo?.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={identityLogo.url} alt={identityLogo.alt} className="partner-logo" />
          <span className="logo-divider" aria-hidden="true" />
        </>
      ) : null}
      <div className="logo">
        <LogoMark />
        {wordmarkAsSpan ? (
          <span className="wm">
            THINK<b>WAY</b>
          </span>
        ) : (
          <b>
            THINK<span>WAY</span>
          </b>
        )}
      </div>
    </div>
  );
}
