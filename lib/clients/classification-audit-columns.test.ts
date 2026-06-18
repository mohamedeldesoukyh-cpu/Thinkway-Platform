import assert from "node:assert/strict";

import {
  CLASSIFICATION_AUDIT_COLUMN_NAMES,
  CLIENT_TAXONOMY_COLUMN_NAMES,
  getInvalidClientEnumColumnFromError,
  getMissingClientColumnFromSchemaError,
  isInvalidClientEnumValueError,
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

function pg42703(column: string) {
  return {
    code: "42703",
    message: `column clients.${column} does not exist`,
  };
}

function invalidEnum(column: string, value: string) {
  return {
    code: "22P02",
    message: `invalid input value for enum ${column}: "${value}"`,
  };
}

function run() {
  for (const column of [
    "name_ar",
    "vr_rate_id",
    ...CLIENT_TAXONOMY_COLUMN_NAMES,
    "credit_limit_active",
    "accept_credit_risk",
    ...CLASSIFICATION_AUDIT_COLUMN_NAMES,
  ]) {
    for (const error of [pgrst204(column), pg42703(column)]) {
      assert.equal(getMissingClientColumnFromSchemaError(error), column);
      assert.equal(isMissingClientColumnSchemaError(error), true);
    }
    assert.ok(
      (OPTIONAL_CLIENT_COLUMN_NAMES as readonly string[]).includes(column),
      `expected ${column} in OPTIONAL_CLIENT_COLUMN_NAMES`
    );
  }

  const enumError = invalidEnum(
    "client_category",
    "marketing_advertising_media_agencies"
  );
  assert.equal(getInvalidClientEnumColumnFromError(enumError), "client_category");
  assert.equal(isInvalidClientEnumValueError(enumError), true);
  assert.equal(
    getInvalidClientEnumColumnFromError({
      code: "22P02",
      message:
        'invalid input value for enum public.client_category: "marketing_advertising_media_agencies"',
    }),
    "client_category"
  );
  assert.equal(
    isInvalidClientEnumValueError({
      code: "22P02",
      message: 'invalid input value for enum other_enum: "foo"',
    }),
    true
  );
  assert.equal(
    getInvalidClientEnumColumnFromError({
      code: "22P02",
      message: 'invalid input value for enum other_enum: "foo"',
    }),
    null
  );
  assert.equal(
    isInvalidClientEnumValueError({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    }),
    false
  );

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
    client_category: "marketing_advertising_media_agencies",
    client_subcategory: "advertising_agency",
    classification_source: "approved",
  };

  assert.deepEqual(stripClientPayloadColumn(payload, "vr_rate_id"), {
    name: "Acme",
    name_ar: "أكمة",
    client_category: "marketing_advertising_media_agencies",
    client_subcategory: "advertising_agency",
    classification_source: "approved",
  });
  assert.deepEqual(stripClientPayloadColumn(payload, "name_ar"), {
    name: "Acme",
    vr_rate_id: "rate-1",
    client_category: "marketing_advertising_media_agencies",
    client_subcategory: "advertising_agency",
    classification_source: "approved",
  });
  assert.deepEqual(stripClientPayloadColumn(payload, "client_category"), {
    name: "Acme",
    name_ar: "أكمة",
    vr_rate_id: "rate-1",
    client_subcategory: "advertising_agency",
    classification_source: "approved",
  });
  assert.equal(stripClientPayloadColumn(payload, "missing_column"), payload);

  console.log("classification-audit-columns.test.ts: ok");
}

run();
