"use client";

import Link, { useLinkStatus } from "next/link";

function ReviewLabel() {
  const { pending } = useLinkStatus();
  return <span role="status" aria-live="polite">{pending ? "Opening campaign…" : "Review campaign"}</span>;
}

export function ClientReviewCampaignCta({ href }: { href: string }) {
  return (
    <Link href={href} className="btn primary"
      style={{ width: "100%", justifyContent: "center", marginTop: 22, minHeight: 44 }}>
      <ReviewLabel />
    </Link>
  );
}
