import "./approved-quotation-immutability.env";

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APPROVED_QUOTATION_LOCKED_MESSAGE,
  NEW_QUOTATION_VERSION_STATUS,
  approvedQuotationMutationError,
  canGenerateQuotationVersion,
  isApprovedQuotationLocked,
} from "@/lib/commercial-sync/rules";
import { deriveQuotationStage, QUOTATION_STAGE_LABEL } from "@/features/client-workspace/journey-state";
import {
  addItemsToQuotation,
  addQuotationItemOption,
  duplicateQuotationItems,
  importShortlistItemsToQuotation,
  updateQuotationHeader,
} from "@/lib/services/quotations/quotation-service";
import {
  removeQuotationItemWithSync,
  returnQuotationItemToShortlist,
  updateQuotationItemCommercials,
} from "@/lib/services/quotations/quotation-commercial-service";
import { updateQuotationClientBrand } from "@/lib/services/quotations/quotation-lifecycle-service";
import { rejectIfApprovedQuotation } from "@/lib/services/quotations/approved-quotation-guard";

type Write = { table: string; op: string };

function createStatusClient(status: string) {
  const writes: Write[] = [];
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = chain;
      builder.order = chain;
      builder.limit = chain;
      builder.maybeSingle = async () => ({
        data:
          table === "quotations"
            ? { status, issue_date: "2026-08-01", shortlist_id: "sl-1" }
            : null,
        error: null,
      });
      builder.single = async () => ({
        data: table === "quotations" ? { status, id: "q1" } : null,
        error: null,
      });
      builder.update = () => {
        writes.push({ table, op: "update" });
        return builder;
      };
      builder.insert = () => {
        writes.push({ table, op: "insert" });
        return builder;
      };
      builder.delete = () => {
        writes.push({ table, op: "delete" });
        return builder;
      };
      return builder;
    },
  };
  return { client: client as never, writes };
}

test("approved quotation creator price and cost cannot be changed", async () => {
  const { client, writes } = createStatusClient("approved");
  const result = await updateQuotationItemCommercials(client, "user-1", {
    item_id: "item-1",
    quotation_id: "q1",
    mode: "cost_revenue",
    cost: 55_000,
    cost_currency: "EGP",
    revenue: 78_571.43,
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, APPROVED_QUOTATION_LOCKED_MESSAGE);
  assert.equal(writes.length, 0);
});

test("approved quotation deliverables and quantities cannot be changed", async () => {
  const { client, writes } = createStatusClient("approved");
  const result = await updateQuotationItemCommercials(client, "user-1", {
    item_id: "item-1",
    quotation_id: "q1",
    mode: "cost_revenue",
    cost: 45_000,
    cost_currency: "EGP",
    revenue: 64_285.71,
    deliverables: [
      {
        platform: "instagram",
        type: "Reel",
        quantity: 3,
        cost: 55_000,
        revenue: 78_571.43,
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, APPROVED_QUOTATION_LOCKED_MESSAGE);
  assert.equal(writes.length, 0);
});

test("approved quotation roster cannot be changed", async () => {
  const add = await addItemsToQuotation(createStatusClient("approved").client, "q1", [
    { creator_name: "New creator", cost_currency: "EGP" },
  ]);
  assert.equal(add.ok, false);
  assert.equal(add.message, APPROVED_QUOTATION_LOCKED_MESSAGE);

  const duplicate = await duplicateQuotationItems(createStatusClient("approved").client, {
    quotation_id: "q1",
    item_ids: ["item-1"],
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.message, APPROVED_QUOTATION_LOCKED_MESSAGE);

  const option = await addQuotationItemOption(createStatusClient("approved").client, {
    quotation_id: "q1",
    item_id: "item-1",
  });
  assert.equal(option.ok, false);
  assert.equal(option.message, APPROVED_QUOTATION_LOCKED_MESSAGE);

  const imported = await importShortlistItemsToQuotation(createStatusClient("approved").client, {
    quotationId: "q1",
    shortlistId: "sl-1",
    itemIds: ["si-1"],
  });
  assert.equal(imported.ok, false);
  assert.equal(imported.message, APPROVED_QUOTATION_LOCKED_MESSAGE);

  const removed = await removeQuotationItemWithSync(createStatusClient("approved").client, "user-1", {
    item_id: "item-1",
    quotation_id: "q1",
  });
  assert.equal(removed.ok, false);
  assert.equal(removed.message, APPROVED_QUOTATION_LOCKED_MESSAGE);

  const returned = await returnQuotationItemToShortlist(createStatusClient("approved").client, "user-1", {
    item_id: "item-1",
    quotation_id: "q1",
  });
  assert.equal(returned.ok, false);
  assert.equal(returned.message, APPROVED_QUOTATION_LOCKED_MESSAGE);
});

test("approved quotation totals and commercial header cannot be changed", async () => {
  const header = await updateQuotationHeader(createStatusClient("approved").client, "user-1", {
    id: "q1",
    currency: "USD",
  });
  assert.equal(header.ok, false);
  assert.equal(header.message, APPROVED_QUOTATION_LOCKED_MESSAGE);

  const unapprove = await updateQuotationHeader(createStatusClient("approved").client, "user-1", {
    id: "q1",
    status: "draft",
  });
  assert.equal(unapprove.ok, false);
  assert.equal(unapprove.message, APPROVED_QUOTATION_LOCKED_MESSAGE);

  const brand = await updateQuotationClientBrand(createStatusClient("approved").client, {
    quotationId: "q1",
    client_id: "c1",
    brand_id: "b1",
  });
  assert.equal(brand.ok, false);
  assert.equal(brand.message, APPROVED_QUOTATION_LOCKED_MESSAGE);
});

test("draft and sent quotations are not blocked by the approved-only lock", async () => {
  assert.equal(isApprovedQuotationLocked("draft"), false);
  assert.equal(isApprovedQuotationLocked("sent"), false);
  assert.equal(approvedQuotationMutationError("draft"), null);
  assert.equal(approvedQuotationMutationError("sent"), null);
  assert.equal(await rejectIfApprovedQuotation(createStatusClient("draft").client, "q1"), null);
  assert.equal(await rejectIfApprovedQuotation(createStatusClient("sent").client, "q1"), null);
});

test("new quotation version can be created from approved quotation as a draft that needs client approval", () => {
  assert.equal(canGenerateQuotationVersion("approved"), true);
  assert.equal(NEW_QUOTATION_VERSION_STATUS, "draft");
  assert.equal(
    deriveQuotationStage({
      quotationExists: true,
      review: { status: "awaiting_review", firstViewedAt: null },
      priorApprovedReview: true,
      movedToCampaign: false,
    }),
    "updated"
  );
  assert.equal(QUOTATION_STAGE_LABEL.updated, "Updated — Approval required");
});
