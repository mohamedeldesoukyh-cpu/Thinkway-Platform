"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ThinkwayPageLoader } from "@/components/layout/thinkway-page-loader";

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

export function ClientReviewCampaignCta({ href }: { href: string }) {
  const [pending, setPending] = useState(false);

  return (
    <>
      <Link
        href={href}
        className="btn primary"
        style={{ width: "100%", justifyContent: "center", marginTop: 22, minHeight: 44 }}
        onClick={(event) => {
          if (isModifiedClick(event)) return;
          setPending(true);
        }}
      >
        Review campaign
      </Link>
      {pending
        ? createPortal(
            <div
              className="tw-review-loading-overlay"
              role="status"
              aria-live="polite"
              aria-label="Loading campaign review"
            >
              <ThinkwayPageLoader label="Loading campaign review" />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
