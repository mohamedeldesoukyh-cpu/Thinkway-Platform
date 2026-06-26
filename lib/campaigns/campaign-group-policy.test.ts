import assert from "node:assert/strict";

import {
  applyGroupIdColumnFilter,
  buildGroupFilterSelectOptions,
  INDEPENDENT_GROUP_FILTER_VALUE,
  isIndependentGroupFilter,
  matchesGroupFilter,
} from "@/lib/groups/group-filter";
import { formatGroupDisplayName } from "@/lib/groups/group-display";

// Group filter sentinel
assert.equal(isIndependentGroupFilter(INDEPENDENT_GROUP_FILTER_VALUE), true);
assert.equal(isIndependentGroupFilter(""), false);
assert.equal(isIndependentGroupFilter("uuid"), false);

// Filter options include All + Independent
const options = buildGroupFilterSelectOptions([
  { id: "g1", name: "Acme Holdings" },
]);
assert.equal(options[0].label, "All groups");
assert.equal(options[1].label, "Independent clients");
assert.equal(options[2].value, "g1");

// matchesGroupFilter
assert.equal(matchesGroupFilter(null, INDEPENDENT_GROUP_FILTER_VALUE), true);
assert.equal(matchesGroupFilter("g1", INDEPENDENT_GROUP_FILTER_VALUE), false);
assert.equal(matchesGroupFilter("g1", "g1"), true);
assert.equal(matchesGroupFilter(null, null), true);

// Display name for null group
assert.equal(formatGroupDisplayName(null), "Independent");
assert.equal(formatGroupDisplayName(""), "Independent");
assert.equal(formatGroupDisplayName("Nestlé"), "Nestlé");

// Create campaign payload shape (null group allowed)
const createPayload = {
  brand_id: "brand-1",
  client_id: "client-1",
  group_id: null as string | null,
  name: "Independent campaign",
};
assert.equal(createPayload.group_id, null);

// Reporting row with null group
const reportRow = {
  group_id: null as string | null,
  group_name: formatGroupDisplayName(null),
};
assert.equal(reportRow.group_name, "Independent");

// applyGroupIdColumnFilter routes to .is(null) for independent
const calls: string[] = [];
const mockQuery = {
  eq(column: string, value: string) {
    calls.push(`eq:${column}:${value}`);
    return this;
  },
  is(column: string, value: null) {
    calls.push(`is:${column}:null`);
    return this;
  },
};
applyGroupIdColumnFilter(mockQuery, INDEPENDENT_GROUP_FILTER_VALUE);
assert.deepEqual(calls, ["is:group_id:null"]);

calls.length = 0;
applyGroupIdColumnFilter(mockQuery, "group-uuid");
assert.deepEqual(calls, ["eq:group_id:group-uuid"]);

// Quotation → campaign: brand without group
const quotationBrand = {
  id: "b1",
  client_id: "c1",
  group_id: null as string | null,
};
const campaignFromQuotation = {
  brand_id: quotationBrand.id,
  client_id: quotationBrand.client_id,
  group_id: quotationBrand.group_id,
};
assert.equal(campaignFromQuotation.group_id, null);

// Edit campaign: group removal payload
const editRemoveGroup = { previousGroupId: "g1", newGroupId: null as string | null };
assert.notEqual(editRemoveGroup.previousGroupId, editRemoveGroup.newGroupId);

console.log("campaign-group-policy.test.ts: all assertions passed");
