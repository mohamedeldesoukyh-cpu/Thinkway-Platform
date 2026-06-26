"use client";

import { BriefcaseIcon } from "lucide-react";

import {
  ClientFormGrid,
  ClientFormSection,
  CLIENT_FORM_FIELD_LABEL_CLASS,
} from "@/features/clients/components/client-form-ui";

type CampaignCommercialSummaryCardProps = {
  groupName: string | null | undefined;
  clientName: string | null | undefined;
  category: string;
  subcategory: string;
  agencyOrDirect: string;
  vrPercent: string;
};

export function CampaignCommercialSummaryCard({
  groupName,
  clientName,
  category,
  subcategory,
  agencyOrDirect,
  vrPercent,
}: CampaignCommercialSummaryCardProps) {
  return (
    <ClientFormSection
      icon={BriefcaseIcon}
      title="Commercial profile"
      description="Inherited from brand and legal entity"
      className="shadow-none"
    >
      <ClientFormGrid>
        <SummaryField label="Group" value={groupName} />
        <SummaryField label="Client" value={clientName} />
        <SummaryField label="Category" value={category} />
        <SummaryField label="Subcategory" value={subcategory} />
        <SummaryField label="Agency / Direct" value={agencyOrDirect} />
        <SummaryField label="VR%" value={vrPercent} />
      </ClientFormGrid>
    </ClientFormSection>
  );
}

function SummaryField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const display = value?.trim();
  return (
    <div className="grid gap-[7px]">
      <p className={CLIENT_FORM_FIELD_LABEL_CLASS}>{label}</p>
      <p className="text-[13.5px] leading-snug text-foreground">
        {display && display !== "—" ? display : "—"}
      </p>
    </div>
  );
}
