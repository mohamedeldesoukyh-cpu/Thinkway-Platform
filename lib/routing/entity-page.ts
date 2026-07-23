import { redirect } from "next/navigation";

import {
  buildEntityRouteKey,
  entityPageTitle,
  shouldRedirectEntityRoute,
  type EntityRouteIdentity,
} from "./entity-slug";

export type EntityPageContext = {
  routeKey: string;
  entity: EntityRouteIdentity & {
    name?: string | null;
    display_name?: string | null;
    document_number?: string | null;
    serial_number?: string | null;
  };
  canonicalPath: string;
};

export function buildEntityPageContext(
  routeKey: string,
  entity: EntityPageContext["entity"],
  detailPath: string
): EntityPageContext {
  return {
    routeKey,
    entity,
    canonicalPath: detailPath,
  };
}

/** Redirect UUID / legacy keys to the canonical slug URL when they differ. */
export function redirectToCanonicalEntityRoute(
  ctx: EntityPageContext,
  canonicalRouteKey?: string,
  searchParams?: Record<string, string | undefined>
): void {
  const canonicalKey =
    canonicalRouteKey ??
    buildEntityRouteKey({
      id: ctx.entity.id,
      slug: ctx.entity.slug,
      displayName: ctx.entity.displayName ?? ctx.entity.name ?? ctx.entity.display_name ?? null,
      documentNumber:
        ctx.entity.documentNumber ??
        ctx.entity.document_number ??
        ctx.entity.serial_number ??
        null,
    });

  if (shouldRedirectEntityRoute(ctx.routeKey, canonicalKey)) {
    const params = new URLSearchParams();
    const [pathname, existingQuery = ""] = ctx.canonicalPath.split("?");
    if (existingQuery) {
      for (const [key, value] of new URLSearchParams(existingQuery)) {
        params.set(key, value);
      }
    }
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value?.trim()) params.set(key, value.trim());
    }
    const query = params.toString();
    redirect(query ? `${pathname}?${query}` : pathname);
  }
}

export function metadataTitleForEntity(
  entity: EntityPageContext["entity"],
  meta?: string | null
): string {
  const displayName =
    entity.displayName?.trim() ||
    entity.name?.trim() ||
    entity.display_name?.trim() ||
    entity.document_number?.trim() ||
    entity.serial_number?.trim() ||
    "Workspace";
  return entityPageTitle(displayName, meta);
}
