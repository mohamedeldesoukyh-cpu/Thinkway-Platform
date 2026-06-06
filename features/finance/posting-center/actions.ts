"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildPostingBatchPreview,
  createPostingBatch,
  postPostingBatch,
  reversePostingBatch,
  unpostPostingBatch,
} from "@/lib/finance/posting-engine";
import type { FinanceDocumentKind } from "@/lib/finance/status/document-kind";

export type PostingCenterActionState = {
  ok: boolean;
  message?: string;
  batch_id?: string;
  document_number?: string;
};

const previewSchema = z.object({
  transaction_type: z.string(),
  period_from: z.string().min(1),
  period_to: z.string().min(1),
  legal_entity_id: z.string().uuid().optional(),
  currency: z.string().length(3).optional(),
});

const batchIdSchema = z.object({
  batch_id: z.string().uuid(),
  reason: z.string().trim().optional(),
});

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error(error?.message ?? "Unauthorized");
  return { supabase, user };
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

    const { supabase } = await requireUser();
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

    const { supabase, user } = await requireUser();

    const created = await createPostingBatch(supabase, {
      transaction_type: parsed.data.transaction_type as FinanceDocumentKind,
      period_from: parsed.data.period_from,
      period_to: parsed.data.period_to,
      legal_entity_id: parsed.data.legal_entity_id,
      currency: parsed.data.currency,
      actor_id: user.id,
    });

    if (!created.ok) return { ok: false, message: created.error };

    const posted = await postPostingBatch(supabase, {
      batch_id: created.batch_id,
      actor_id: user.id,
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

    const { supabase, user } = await requireUser();
    const result = await reversePostingBatch(supabase, {
      batch_id: parsed.data.batch_id,
      actor_id: user.id,
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

    const { supabase, user } = await requireUser();
    const result = await unpostPostingBatch(supabase, {
      batch_id: parsed.data.batch_id,
      actor_id: user.id,
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
