import type { MasterCommercialValues } from "@/lib/services/commercial/types";

/** Shared form action result shape — keep outside "use server" modules for client-safe type imports. */
export type FormActionState = {
  ok: boolean;
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  campaignId?: string;
  commercialSync?: {
    revisionCurrent?: MasterCommercialValues;
    revisionProposed?: MasterCommercialValues;
    commercialLineId?: string | null;
    quotationId?: string | null;
    campaignHeaderId?: string | null;
    assignmentIds?: string[];
    quotationSerial?: string | null;
    campaignDocumentNumber?: string | null;
    concurrencyToken?: string | null;
    confirmationTitle?: string;
    confirmationDescription?: string;
  };
};
