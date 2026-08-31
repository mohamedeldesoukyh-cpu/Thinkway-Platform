import Link from "next/link";

import type { CreatorHomeNextAction } from "@/features/creator-workspace/home-next-actions";
import { CreatorApproveVendorIoForm } from "@/features/portals/components/creator-approve-vendor-io-form";
import { CreatorRejectVendorIoForm } from "@/features/portals/components/creator-reject-vendor-io-form";

function ActionIcon({ tone }: { tone: CreatorHomeNextAction["tone"] }) {
  if (tone === "red") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
    );
  }
  if (tone === "amber") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
      </svg>
    );
  }
  if (tone === "green") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M22 2 11 13" />
        <path d="M22 2l-7 20-4-9-9-4z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

export function CreatorHomeNextActionList({
  actions,
}: {
  actions: CreatorHomeNextAction[];
}) {
  if (actions.length === 0) {
    return (
      <section className="act act--calm">
        <div className="act__row" style={{ border: "none", padding: "2px 0" }}>
          <span className="act__ic act__ic--green">
            <svg viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span className="act__b">
            <span className="act__h">You are all caught up</span>
            <span className="act__s">Nothing to upload, fix or publish right now.</span>
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="act">
      <div className="act__t">
        <span className="act__n num">{actions.length}</span>
        <span className="act__l">Needs your attention</span>
      </div>
      {actions.map((action) => (
        <div key={action.id}>
          <div className="act__row">
            <span className={`act__ic act__ic--${action.tone}`}>
              <ActionIcon tone={action.tone} />
            </span>
            <span className="act__b">
              <span className="act__h">{action.title}</span>
              <span className="act__s">{action.description}</span>
            </span>
            <Link href={action.href} className="btn btn-primary btn-sm">
              {action.cta}
            </Link>
          </div>
          {action.kind === "vendor_io" && action.vendorIoId ? (
            <div className="actions" style={{ marginTop: 8, paddingLeft: 45 }}>
              <CreatorApproveVendorIoForm vendorIoId={action.vendorIoId} />
              <CreatorRejectVendorIoForm vendorIoId={action.vendorIoId} />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
