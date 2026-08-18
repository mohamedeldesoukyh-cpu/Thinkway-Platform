"use client";

import { useEffect, useState } from "react";

import { acknowledgeReviewUpdateAction } from "../actions/client-workspace-actions";
import { IconClose } from "./review-icons";

function updateBannerStorageKey(reviewId: string, updatedAt: string) {
  return `tw-cw-update:${reviewId}:${updatedAt}`;
}

export function ReviewUpdateBanner({
  reviewId,
  token,
  updatedAt,
  items,
}: {
  reviewId: string;
  token: string;
  updatedAt: string;
  items: string[];
}) {
  const storageKey = updateBannerStorageKey(reviewId, updatedAt);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(storageKey)) setHidden(true);
  }, [storageKey]);

  function dismiss() {
    setHidden(true);
    window.localStorage.setItem(storageKey, "1");
    void acknowledgeReviewUpdateAction({ token });
  }

  if (hidden || items.length === 0) return null;

  return (
    <div className="update-banner" role="status">
      <div className="wrap">
        <div>
          <p className="uh">This proposal was updated</p>
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <button type="button" className="btn update-dismiss" onClick={dismiss}>
          <IconClose />
          Got it
        </button>
      </div>
    </div>
  );
}
