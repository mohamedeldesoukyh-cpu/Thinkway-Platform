/**
 * Authorization for detailed /api/ready payloads.
 * Public callers must only receive `{ status: "ok" }`.
 */

export function authorizeReadyDetailRequest(request: {
  headers: { get(name: string): string | null };
}): boolean {
  const secret = process.env.READY_API_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const headerSecret =
    request.headers.get("x-ready-api-secret")?.trim() ||
    request.headers.get("READY_API_SECRET")?.trim();

  if (headerSecret && headerSecret === secret) {
    return true;
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  return false;
}

export function isReadyAdminRole(roleSlug: string | null | undefined): boolean {
  return roleSlug === "super_admin" || roleSlug === "admin";
}
