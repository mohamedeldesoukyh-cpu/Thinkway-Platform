import assert from "node:assert/strict";
import { resolveSelectionActions, type SelectionActionRowInput } from "./selection-action-engine";
import { deriveAssignmentLineMeta } from "../campaigns/assignment-row-view-model";

const row = {
  lineId: "line-1",
  group: {
    line: {id:"line-1",vendor_io_id:"io-1",active_vendor_io_id:"io-1",billing_status:"moved_to_billing",operational_status:"io_generated",invoice_id:null,revenue_before_vat:100,cost_before_vat:75,assignment:{pricing_mode:"package"}},
    deliverables:[], rollups:{revenue:100,remaining_value:100,invoiced_value:0},
  },
  meta:{vioEligible:false,invoiceEligible:true,reviseVioEligible:false,ungenerateIoEligible:true,rowSelectable:true,remaining:100},
} as unknown as SelectionActionRowInput;
const input = {selectedLineIds:["line-1"],selectedDeliverableIds:[],preparedRows:[row]};
assert.deepEqual(resolveSelectionActions(input).ungenerateIoLineIds,["line-1"],"invoice eligibility must not hide reopening an unpaid IO");
row.meta!.ungenerateIoEligible=false;
assert.deepEqual(resolveSelectionActions(input).ungenerateIoLineIds,[],"server payment/finance block must disable reopening");
const blockedGroup = {
  ...row.group,
  line: { ...row.group.line, vendor_io_reopen_eligible: false, vendor_io_reopen_reason: "Clear payment first", invoice_id: "invoice-1", billing_status: "paid" },
  rollups: { ...row.group.rollups, remaining_value: 0, invoiced_value: 100 },
};
const blockedMeta = deriveAssignmentLineMeta(blockedGroup);
assert.equal(blockedMeta.ungenerateIoEligible, false);
assert.equal(blockedMeta.rowSelectable, true, "blocked rows remain selectable to explain the payment restriction");
console.log("Vendor IO selection tests passed");
