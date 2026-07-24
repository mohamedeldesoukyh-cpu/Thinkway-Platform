import assert from "node:assert/strict";
import test from "node:test";

import {
  csvEscapeCell,
  csvEscapeRow,
  needsSpreadsheetFormulaNeutralization,
  neutralizeSpreadsheetFormula,
} from "./csv-formula";

test("neutralizeSpreadsheetFormula prefixes formula triggers", () => {
  for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) {
    const value = `${prefix}CMD`;
    assert.equal(needsSpreadsheetFormulaNeutralization(value), true);
    assert.equal(neutralizeSpreadsheetFormula(value), `'${value}`);
  }
  assert.equal(neutralizeSpreadsheetFormula("safe text"), "safe text");
  assert.equal(neutralizeSpreadsheetFormula(12.5), 12.5);
});

test("csvEscapeCell quotes and neutralizes", () => {
  assert.equal(csvEscapeCell("=1+1"), `"'=1+1"`);
  assert.equal(csvEscapeCell('say "hi"'), `"say ""hi"""`);
  assert.equal(csvEscapeRow(["=cmd", "ok"]), `"'=cmd","ok"`);
});
