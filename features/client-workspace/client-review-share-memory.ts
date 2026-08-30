const STORAGE_PREFIX = "tw.client-review-share.";

export type ClientReviewShareMemory = {
  url: string;
  reviewNumber: number;
  reviewId: string;
};

export type ClientReviewShareScope =
  | { source: "quotation"; id: string }
  | { source: "shortlist"; id: string }
  | { source: "studio"; id: string }
  | { source: "campaign"; id: string };

function storageKey(scope: ClientReviewShareScope): string {
  return `${STORAGE_PREFIX}${scope.source}.${scope.id}`;
}

export function rememberClientReviewShare(
  scope: ClientReviewShareScope,
  value: ClientReviewShareMemory
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(value));
  } catch {
    /* private mode / quota — Show link can still reissue */
  }
}

export function forgetClientReviewShare(scope: ClientReviewShareScope): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(scope));
  } catch {
    /* private mode / quota */
  }
}

export function readClientReviewShare(scope: ClientReviewShareScope): ClientReviewShareMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClientReviewShareMemory>;
    if (!parsed.url?.trim() || parsed.reviewNumber == null || !parsed.reviewId?.trim()) return null;
    return {
      url: parsed.url.trim(),
      reviewNumber: parsed.reviewNumber,
      reviewId: parsed.reviewId.trim(),
    };
  } catch {
    return null;
  }
}

export function reviewIdFromShareUrl(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/review\/([^/]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}
