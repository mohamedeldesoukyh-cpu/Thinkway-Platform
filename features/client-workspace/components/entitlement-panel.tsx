"use client";

import { useState, useTransition } from "react";

import { requestClientWorkspaceAccessAction } from "../actions/client-workspace-actions";
import {
  CLIENT_WORKSPACE_PACKAGE_LABEL,
  entitlementPanelCopy,
  type ClientWorkspaceNavSection,
} from "../entitlement";

export function ClientWorkspaceEntitlementPanel({
  token,
  section,
}: {
  token: string;
  section: ClientWorkspaceNavSection;
}) {
  const copy = entitlementPanelCopy(section);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card cx-entitle">
      <p className="ck">Thinkway Client Workspace</p>
      <h2>{copy.title}</h2>
      <p className="note">{copy.body}</p>
      <div className="cx-entitle__acts">
        <button
          type="button"
          className="btn pri"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await requestClientWorkspaceAccessAction({ token, section });
              setMessage(result.message);
            });
          }}
        >
          Request access
        </button>
      </div>
      <p className="cx-entitle__sec">Your account team enables this as a service entitlement.</p>
      {message ? <p className="note">{message}</p> : null}
      <p className="cx-entitle__pkg">{CLIENT_WORKSPACE_PACKAGE_LABEL[copy.packageName]}</p>
    </div>
  );
}
