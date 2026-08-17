import { cookies } from "next/headers";

import { CLIENT_REVIEW_COOKIE } from "../constants";
import { parseReviewCookie } from "../security/review-token";

export async function resolveReviewToken(
  reviewId: string,
  searchToken?: string | null
): Promise<string | null> {
  const fromQuery = searchToken?.trim();
  if (fromQuery && fromQuery.length >= 16) return fromQuery;
  const store = await cookies();
  const parsed = parseReviewCookie(store.get(CLIENT_REVIEW_COOKIE)?.value);
  if (parsed?.reviewId === reviewId) return parsed.token;
  return null;
}
