"use server";

import { revalidatePath } from "next/cache";

import { requireFinancePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPostingBatchPreview,
  createPostingBatch,
  postPostingBatch,
  reversePostingBatch,
  unpostPostingBatch,
} from "@/lib/finance/posting-engine";
import type { FinanceDocumentKind } from "@/lib/finance/status/document-kind";
import {
  financeBatchIdSchema,
  financePostingPreviewSchema,
} from "@/lib/validation/schemas";

export type PostingCenterActionState = {
  ok: boolean;
  message?: string;
  batch_id?: string;
  document_number?: string;
};

const previewSchema = financePostingPreviewSchema;
const batchIdSchema = financeBatchIdSchema;

async function requireFinanceActor(permission: "finance.read" | "finance.write") {
  const supabase = await createSupabaseServerClient();
  const access = await requireFinancePermission(supabase, permission);
  if ("error" in access) {
    throw new Error(access.error);
  }
  return { supabase, userId: access.userId };
}

export async function previewPostingBatchAction(
  _prev: PostingCenterActionState,
  formData: FormData
): Promise<PostingCenterActionState> {
  try {
    const parsed = previewSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { ok: false, message: "Period and transaction type are required." };
    }

    const { supabase } = await requireFinanceActor("finance.read");
    const preview = await buildPostingBatchPreview(supabase, {
      transaction_type: parsed.data.transaction_type as FinanceDocumentKind,
      period_from: parsed.data.period_from,
      period_to: parsed.data.period_to,
      legal_entity_id: parsed.data.legal_entity_id,
      currency: parsed.data.currency,
      status: "approved",
    });

    revalidatePath("/finance/posting-center");
    return {
      ok: true,
      message: `${preview.length} document(s) ready for posting.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Preview failed.",
    };
  }
}

export async function createAndPostBatchAction(
  _prev: PostingCenterActionState,
  formData: FormData
): Promise<PostingCenterActionState> {
  try {
    const parsed = previewSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { ok: false, message: "Period and transaction type are required." };
    }

    const { supabase, userId } = await requireFinanceActor("finance.write");

    const created = await createPostingBatch(supabase, {
      transaction_type: parsed.data.transaction_type as FinanceDocumentKind,
      period_from: parsed.data.period_from,
      period_to: parsed.data.period_to,
      legal_entity_id: parsed.data.legal_entity_id,
      currency: parsed.data.currency,
      actor_id: userId,
    });

    if (!created.ok) return { ok: false, message: created.error };

    const posted = await postPostingBatch(supabase, {
      batch_id: created.batch_id,
      actor_id: userId,
    });

    if (!posted.ok) return { ok: false, message: posted.error };

    revalidatePath("/finance/posting-center");
    return {
      ok: true,
      message: `Batch ${posted.document_number} posted.`,
      batch_id: posted.batch_id,
      document_number: posted.document_number,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Post failed.",
    };
  }
}

export async function reversePostingBatchAction(
  _prev: PostingCenterActionState,
  formData: FormData
): Promise<PostingCenterActionState> {
  try {
    const parsed = batchIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { ok: false, message: "Batch id is required." };
    }

    const { supabase, userId } = await requireFinanceActor("finance.write");
    const result = await reversePostingBatch(supabase, {
      batch_id: parsed.data.batch_id,
      actor_id: userId,
      reason: parsed.data.reason,
    });

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath("/finance/posting-center");
    return {
      ok: true,
      message: `Batch ${result.document_number} reversed.`,
      batch_id: result.batch_id,
      document_number: result.document_number,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Reverse failed.",
    };
  }
}

export async function unpostPostingBatchAction(
  _prev: PostingCenterActionState,
  formData: FormData
): Promise<PostingCenterActionState> {
  try {
    const parsed = batchIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { ok: false, message: "Batch id is required." };
    }

    const { supabase, userId } = await requireFinanceActor("finance.write");
    const result = await unpostPostingBatch(supabase, {
      batch_id: parsed.data.batch_id,
      actor_id: userId,
    });

    if (!result.ok) return { ok: false, message: result.error };

    revalidatePath("/finance/posting-center");
    return {
      ok: true,
      message: `Draft batch ${result.document_number} removed from queue.`,
      batch_id: result.batch_id,
      document_number: result.document_number,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unpost failed.",
    };
  }
}
