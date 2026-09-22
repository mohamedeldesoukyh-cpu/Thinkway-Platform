import type { Metadata } from "next";

export const SHARE_DESCRIPTION = "View your creator shortlist, quotation, and campaign details.";

export function shareImagePath(reviewId: string, token: string, version = "1") {
  return `/api/review/share-image?${new URLSearchParams({ reviewId, sign: token, v: version })}`;
}

export function campaignShareMetadata(input: {
  campaignName: string; reviewId: string; token: string; origin: string; version?: string;
}): Metadata {
  const title = input.campaignName.trim() || "Your campaign · Thinkway";
  const image = new URL(shareImagePath(input.reviewId, input.token, input.version), input.origin).href;
  return {
    title: { absolute: title }, description: SHARE_DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website", siteName: "Thinkway", title, description: SHARE_DESCRIPTION,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description: SHARE_DESCRIPTION, images: [image] },
  };
}
