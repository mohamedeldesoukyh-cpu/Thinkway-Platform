"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { getCampaignPlanExecutionContext } from "@/features/campaign-plan/actions/generate-campaign-from-plan";
import { getCampaignPlanQuotationContext } from "@/features/campaign-plan/actions/generate-quotation-from-plan";
import { campaignDetailPath, quotationDetailPath } from "@/lib/routing/entity-paths";

type LinkTarget =
  | { kind: "campaign"; href: string; label: string }
  | { kind: "quotation"; href: string; label: string }
  | null;

type StudioLinkedEntityOpenProps = {
  campaignObjectId?: string | null;
  conversationId?: string | null;
  className?: string;
};

/**
 * Studio navigational CTA — Open Campaign if linked, else Open Quotation, else hide.
 * Never shows a disabled action (D5).
 */
export function StudioLinkedEntityOpen({
  campaignObjectId,
  conversationId,
  className,
}: StudioLinkedEntityOpenProps) {
  const [target, setTarget] = useState<LinkTarget>(null);

  useEffect(() => {
    if (!campaignObjectId) {
      setTarget(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const campaignCtx = await getCampaignPlanExecutionContext({
        campaignObjectId,
        conversationId: conversationId ?? undefined,
      });
      if (cancelled) return;
      if (campaignCtx && !("error" in campaignCtx) && campaignCtx.existingCampaign) {
        const c = campaignCtx.existingCampaign;
        setTarget({
          kind: "campaign",
          href: campaignDetailPath({
            id: c.id,
            document_number: c.documentNumber,
          }),
          label: "Open Campaign",
        });
        return;
      }

      const quotationCtx = await getCampaignPlanQuotationContext({
        campaignObjectId,
        conversationId: conversationId ?? undefined,
      });
      if (cancelled) return;
      if (quotationCtx && !("error" in quotationCtx) && quotationCtx.existingQuotation) {
        const q = quotationCtx.existingQuotation;
        setTarget({
          kind: "quotation",
          href: quotationDetailPath({
            id: q.id,
            document_number: q.serialNumber,
          }),
          label: "Open Quotation",
        });
        return;
      }
      setTarget(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignObjectId, conversationId]);

  if (!target) return null;

  return (
    <Link href={target.href} className={className ?? "oc-btn"}>
      <ExternalLinkIcon aria-hidden />
      {target.label}
    </Link>
  );
}
