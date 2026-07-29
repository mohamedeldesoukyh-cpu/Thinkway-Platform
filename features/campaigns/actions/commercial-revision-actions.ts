"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildRevisionLinesFromProposals,
  createCommercialRevisionService,
} from "@/lib/services/commercial/commercial-revision-service";
import { createSupabaseRevisionPorts } from "@/lib/services/commercial/commercial-revision-supabase-ports";
import { createSupabaseCommercialSyncPorts } from "@/lib/services/commercial/supabase-ports";
import { masterFieldLabel } from "@/lib/services/commercial/field-registry";
import type {
  CommercialRevisionRecord,
  CommercialVersionHistoryEntry,
} from "@/lib/services/commercial/commercial-revision-types";
import type { MasterCommercialValues } from "@/lib/services/commercial/types";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient<Database>;

export type CommercialRevisionActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; code?: string };

export type CommercialRevisionProposalLine = {
  commercialLineId: string;
  assignmentIds?: string[];
  proposed: MasterCommercialValues;
  concurrencyToken?: string | null;
};

async function getWriteActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    const admin = await requirePermission(supabase, "campaigns.admin");
    if ("error" in admin) return { ok: false, message: auth.error };
    return { ok: true, supabase, userId: admin.userId };
  }
  return { ok: true, supabase, userId: auth.userId };
}

async function getDecideActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const decide = await requirePermission(supabase, "approvals.decide");
  if (!("error" in decide)) {
    return { ok: true, supabase, userId: decide.userId };
  }
  const admin = await requirePermission(supabase, "campaigns.admin");
  if ("error" in admin) return { ok: false, message: decide.error };
  return { ok: true, supabase, userId: admin.userId };
}

function revisionService(supabase: Supabase) {
  return createCommercialRevisionService(
    createSupabaseRevisionPorts(supabase),
    createSupabaseCommercialSyncPorts(supabase)
  );
}

function revalidateCommercial(campaignHeaderId: string, quotationId?: string) {
  revalidatePath(`/campaigns/${campaignHeaderId}`);
  revalidatePath("/campaigns");
  revalidatePath("/quotations");
  if (quotationId) revalidatePath(`/quotations/${quotationId}`);
}

export async function createAndSubmitCommercialRevisionAction(input: {
  campaignHeaderId: string;
  quotationId: string;
  reason: string;
  comments?: string | null;
  lines: CommercialRevisionProposalLine[];
}): Promise<
  CommercialRevisionActionResult<{
    revision: CommercialRevisionRecord;
    fieldSummary: Array<{ label: string; oldValue: unknown; newValue: unknown }>;
  }>
> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;

  if (!input.lines.length) {
    return { ok: false, message: "No commercial changes to revise.", code: "VALIDATION" };
  }

  const syncPorts = createSupabaseCommercialSyncPorts(actor.supabase);
  const proposals = [];
  const concurrencyTokens: Record<string, string> = {};

  for (const line of input.lines) {
    const current = await syncPorts.loadQuotationMaster(line.commercialLineId);
    if (!current) {
      return {
        ok: false,
        message: `Commercial Line ${line.commercialLineId} not found`,
        code: "LINE_MISSING",
      };
    }
    const registry = await syncPorts.resolveByQuotationItemId(
      line.commercialLineId
    );
    proposals.push({
      commercialLineId: line.commercialLineId,
      assignmentIds: line.assignmentIds ?? registry?.assignmentIds ?? [],
      current,
      proposed: line.proposed,
    });
    const token =
      line.concurrencyToken ??
      (await syncPorts.loadConcurrencyToken(line.commercialLineId));
    if (token) concurrencyTokens[line.commercialLineId] = token;
  }

  const svc = revisionService(actor.supabase);
  const created = await svc.createRevision({
    actorId: actor.userId,
    campaignHeaderId: input.campaignHeaderId,
    quotationId: input.quotationId,
    reason: input.reason,
    comments: input.comments,
    lines: buildRevisionLinesFromProposals(proposals),
    concurrencyTokens,
  });
  if (!created.ok) {
    return { ok: false, message: created.message, code: created.code };
  }

  const submitted = await svc.submitRevision(created.data.id, actor.userId);
  if (!submitted.ok) {
    return { ok: false, message: submitted.message, code: submitted.code };
  }

  revalidateCommercial(input.campaignHeaderId, input.quotationId);

  const fieldSummary = submitted.data.lines.flatMap((line) =>
    (line.fieldChanges ?? []).map((change) => ({
      label: change.label || masterFieldLabel(change.field),
      oldValue: change.oldValue,
      newValue: change.newValue,
    }))
  );

  return {
    ok: true,
    data: { revision: submitted.data, fieldSummary },
    message: `Commercial Revision R${submitted.data.revisionNumber} submitted for approval`,
  };
}

export async function approveCommercialRevisionAction(input: {
  revisionId: string;
  decisionNotes?: string | null;
}): Promise<
  CommercialRevisionActionResult<{
    revision: CommercialRevisionRecord;
    version: CommercialVersionHistoryEntry;
  }>
> {
  const actor = await getDecideActor();
  if (!actor.ok) return actor;

  const svc = revisionService(actor.supabase);
  const result = await svc.approveAndApplyRevision(
    input.revisionId,
    actor.userId,
    input.decisionNotes
  );
  if (!result.ok) {
    return { ok: false, message: result.message, code: result.code };
  }

  revalidateCommercial(
    result.data.revision.campaignHeaderId,
    result.data.revision.quotationId
  );
  return {
    ok: true,
    data: result.data,
    message: `Commercial Revision R${result.data.revision.revisionNumber} applied (v${result.data.version.versionNumber})`,
  };
}

export async function rejectCommercialRevisionAction(input: {
  revisionId: string;
  decisionNotes?: string | null;
}): Promise<CommercialRevisionActionResult<CommercialRevisionRecord>> {
  const actor = await getDecideActor();
  if (!actor.ok) return actor;

  const svc = revisionService(actor.supabase);
  const result = await svc.rejectRevision(
    input.revisionId,
    actor.userId,
    input.decisionNotes
  );
  if (!result.ok) {
    return { ok: false, message: result.message, code: result.code };
  }

  revalidateCommercial(result.data.campaignHeaderId, result.data.quotationId);
  return {
    ok: true,
    data: result.data,
    message: `Commercial Revision R${result.data.revisionNumber} rejected`,
  };
}

export async function cancelCommercialRevisionAction(input: {
  revisionId: string;
}): Promise<CommercialRevisionActionResult<CommercialRevisionRecord>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;

  const svc = revisionService(actor.supabase);
  const result = await svc.cancelRevision(input.revisionId, actor.userId);
  if (!result.ok) {
    return { ok: false, message: result.message, code: result.code };
  }

  revalidateCommercial(result.data.campaignHeaderId, result.data.quotationId);
  return {
    ok: true,
    data: result.data,
    message: `Commercial Revision R${result.data.revisionNumber} cancelled`,
  };
}

export async function listCommercialRevisionsAction(input: {
  campaignHeaderId: string;
}): Promise<
  CommercialRevisionActionResult<{
    revisions: CommercialRevisionRecord[];
    versions: CommercialVersionHistoryEntry[];
  }>
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const candidates = [
    "campaigns.read",
    "campaigns.write",
    "campaigns.admin",
    "approvals.read",
    "approvals.decide",
  ] as const;
  let allowed = false;
  let lastError = "Unauthorized";
  for (const permission of candidates) {
    const auth = await requirePermission(supabase, permission);
    if (!("error" in auth)) {
      allowed = true;
      break;
    }
    lastError = auth.error;
  }
  if (!allowed) return { ok: false, message: lastError };

  const svc = revisionService(supabase);
  const [revisions, versions] = await Promise.all([
    svc.listRevisions(input.campaignHeaderId),
    svc.listVersionHistory(input.campaignHeaderId),
  ]);

  return { ok: true, data: { revisions, versions } };
}
