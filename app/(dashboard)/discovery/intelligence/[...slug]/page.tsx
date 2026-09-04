import { notFound } from "next/navigation";

/**
 * Pack 06: unknown intelligence params must 404 explicitly —
 * never fall through to another page's content.
 * Static sibling `library/page.tsx` wins for the real route.
 */
export default function UnknownDiscoveryIntelligenceRoute() {
  notFound();
}
