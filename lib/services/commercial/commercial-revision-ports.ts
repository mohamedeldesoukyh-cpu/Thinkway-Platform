/**
 * Persistence ports for Commercial Revision (in-memory or Supabase).
 */

import type { FinanceLockResult } from "@/lib/finance/campaign-finance-lock";

import type {
  CommercialRevisionRecord,
  CommercialVersionHistoryEntry,
} from "./commercial-revision-types";

export type CommercialRevisionPorts = {
  financeLocked: (campaignHeaderId: string) => Promise<FinanceLockResult>;
  lineExists: (commercialLineId: string) => Promise<boolean>;
  canDecide: (actorId: string) => Promise<boolean>;
  loadConcurrencyToken: (commercialLineId: string) => Promise<string | null>;
  getRevision: (revisionId: string) => Promise<CommercialRevisionRecord | null>;
  saveRevision: (record: CommercialRevisionRecord) => Promise<void>;
  listRevisions: (campaignHeaderId: string) => Promise<CommercialRevisionRecord[]>;
  findPendingRevision: (
    campaignHeaderId: string
  ) => Promise<CommercialRevisionRecord | null>;
  nextRevisionNumber: (campaignHeaderId: string) => Promise<number>;
  nextCommercialVersion: (campaignHeaderId: string) => Promise<number>;
  appendVersionHistory: (
    entry: CommercialVersionHistoryEntry
  ) => Promise<void>;
  listVersionHistory: (
    campaignHeaderId: string
  ) => Promise<CommercialVersionHistoryEntry[]>;
};
