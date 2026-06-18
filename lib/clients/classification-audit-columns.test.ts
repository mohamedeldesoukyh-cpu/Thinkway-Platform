import assert from "node:assert/strict";

import {
  CLASSIFICATION_AUDIT_COLUMN_NAMES,
  getMissingClientColumnFromSchemaError,
  isMissingClientColumnSchemaError,
  OPTIONAL_CLIENT_COLUMN_NAMES,
  stripClientPayloadColumn,
} from "./classification-audit-columns";

function pgrst204(column: string) {
  return {
    code: "PGRST204",
    message: `Could not find the '${column}' column of 'clients' in the schema cache`,
  };
}

function run() {
  for (const column of [
    "name_ar",
    "vr_rate_id",
    "client_category",
    "client_subcategory",
    "credit_limit_active",
    "accept_credit_risk",
    ...CLASSIFICATION_AUDIT_COLUMN_NAMES,
  ]) {
    const error = pgrst204(column);
    assert.equal(getMissingClientColumnFromSchemaError(error), column);
    assert.equal(isMissingClientColumnSchemaError(error), true);
    assert.ok(
      (OPTIONAL_CLIENT_COLUMN_NAMES as readonly string[]).includes(column),
      `expected ${column} in OPTIONAL_CLIENT_COLUMN_NAMES`
    );
  }

  assert.equal(
    getMissingClientColumnFromSchemaError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    }),
    null
  );
  assert.equal(isMissingClientColumnSchemaError(null), false);

  const payload = {
    name: "Acme",
    name_ar: "أكمة",
    vr_rate_id: "rate-1",
    classification_source: "approved",
  };

  assert.deepEqual(stripClientPayloadColumn(payload, "vr_rate_id"), {
    name: "Acme",
    name_ar: "أكمة",
    classification_source: "approved",
  });
  assert.deepEqual(stripClientPayloadColumn(payload, "name_ar"), {
    name: "Acme",
    vr_rate_id: "rate-1",
    classification_source: "approved",
  });
  assert.equal(stripClientPayloadColumn(payload, "missing_column"), payload);

  console.log("classification-audit-columns.test.ts: ok");
}

run();
