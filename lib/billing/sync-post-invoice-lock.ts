import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/dev-log";

const POST_INVOICE_SELECT =
  "id, billable_amount, revenue_before_vat, invoiced_amount, remaining_amount";

const POST_INVOICE_FALLBACK = "id, revenue_before_vat";

/**
 * When a deliverable is locked on invoice, post rows must reflect the same
 * invoiced/remaining amounts or queue rollups (post-sum path) stay at zero.
 */
export async function syncPostScheduleOnDeliverableInvoiceLock(
  supabase: SupabaseClient,
  input: {
    deliverableId: string;
    invoiceLineItemId: string;
    lockedAt: string;
    deliverableBillable: number;
  }
): Promise<{ error?: string }> {
  const postResult = await supabase
    .from("assignment_post_schedule")
    .select(POST_INVOICE_SELECT)
    .eq("assignment_deliverable_id", input.deliverableId)
    .order("sequence_number");

  type PostRow = {
    id: string;
    billable_amount?: number | null;
    revenue_before_vat?: number | null;
  };

  let posts: PostRow[] | null = (postResult.data ?? null) as PostRow[] | null;

  if (postResult.error && /column|does not exist/i.test(postResult.error.message)) {
    const fallback = await supabase
      .from("assignment_post_schedule")
      .select(POST_INVOICE_FALLBACK)
      .eq("assignment_deliverable_id", input.deliverableId)
      .order("sequence_number");
    if (fallback.error) {
      return { error: fallback.error.message };
    }
    posts = (fallback.data ?? []).map((row) => {
      const typed = row as { id: string; revenue_before_vat: number };
      return {
        id: typed.id,
        revenue_before_vat: typed.revenue_before_vat,
        billable_amount: Number(typed.revenue_before_vat ?? 0),
      };
    });
  } else if (postResult.error) {
    return { error: postResult.error.message };
  }

  if (!posts || posts.length === 0) {
    return {};
  }

  const typedPosts = posts;
  const totalPostBillable = typedPosts.reduce(
    (sum, post) =>
      sum +
      Number(
        post.billable_amount ??
          post.revenue_before_vat ??
          0
      ),
    0
  );
  const deliverableBillable = roundMoney(
    input.deliverableBillable > 0 ? input.deliverableBillable : totalPostBillable
  );

  for (const post of typedPosts) {
    const postBillable = roundMoney(
      Number(post.billable_amount ?? post.revenue_before_vat ?? 0)
    );
    const share =
      totalPostBillable > 0 && deliverableBillable > 0
        ? roundMoney((postBillable / totalPostBillable) * deliverableBillable)
        : postBillable;

    const { error } = await supabase
      .from("assignment_post_schedule")
      .update({
        invoiced_amount: share,
        remaining_amount: 0,
        billing_status: "invoiced",
        invoice_line_item_id: input.invoiceLineItemId,
        invoiced_at: input.lockedAt,
        locked_at: input.lockedAt,
      })
      .eq("id", post.id);

    if (error) {
      return { error: error.message };
    }
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[operational-invoice-sync] synced post schedule after deliverable lock", {
      deliverableId: input.deliverableId,
      postCount: typedPosts.length,
      deliverableBillable,
    });
  }

  return {};
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
