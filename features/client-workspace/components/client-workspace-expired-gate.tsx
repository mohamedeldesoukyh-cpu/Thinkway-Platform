"use client";

import { ClientWorkspaceAccessRequest } from "./client-workspace-access-request";

export function ClientWorkspaceExpiredGate({
  expired,
  reviewId,
  token,
  children,
}: {
  expired?: boolean;
  reviewId: string;
  token: string;
  children: React.ReactNode;
}) {
  if (!expired) return children;
  return (
    <div className="cx-expired-root">
      <div className="cx-expired-dim" aria-hidden inert>
        {children}
      </div>
      <div className="cx-expired-veil">
        <div className="tw-review cx-expired-shell">
          <ClientWorkspaceAccessRequest reviewId={reviewId} token={token} />
        </div>
      </div>
    </div>
  );
}
