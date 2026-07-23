import assert from "node:assert/strict";

import {
  QUOTATION_SERIAL_ICON_COLORS,
  quotationSerialIconColor,
} from "./quotation-serial-color";

{
  const id = "550e8400-e29b-41d4-a716-446655440000";
  const first = quotationSerialIconColor(id);
  const second = quotationSerialIconColor(id);
  assert.equal(first, second);
  assert.ok(QUOTATION_SERIAL_ICON_COLORS.includes(first as (typeof QUOTATION_SERIAL_ICON_COLORS)[number]));
}

console.log("quotation-serial-color.test.ts passed");
