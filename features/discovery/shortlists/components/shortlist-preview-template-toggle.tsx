"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";

import {
  SHORTLIST_TEMPLATE_OPTIONS,
  appendShortlistTemplateParam,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";

type ShortlistPreviewTemplateToggleProps = {
  shortlistId: string;
  activeTemplate: ShortlistTemplateVariant;
  itemIds?: string[];
  basePath?: string;
};

export function ShortlistPreviewTemplateToggle({
  shortlistId,
  activeTemplate,
  itemIds,
  basePath,
}: ShortlistPreviewTemplateToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedBasePath =
    basePath ?? pathname ?? `/discovery/shortlists/${shortlistId}/preview`;

  return <select aria-label="Shortlist template" value={activeTemplate} className="h-8 max-w-48 rounded-md border px-2" onChange={event => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    appendShortlistTemplateParam(params, event.target.value as ShortlistTemplateVariant);
    if (itemIds?.length) params.set("items", itemIds.join(",")); else params.delete("items");
    router.push(`${resolvedBasePath}?${params.toString()}`);
  }}>{SHORTLIST_TEMPLATE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>;
}
