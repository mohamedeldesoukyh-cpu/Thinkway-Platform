export function buildClientReviewPath(reviewId: string, token: string, section?: string): string {
  const base = section ? `/review/${reviewId}/${section}` : `/review/${reviewId}`;
  const params = new URLSearchParams({ sign: token });
  return `${base}?${params.toString()}`;
}
