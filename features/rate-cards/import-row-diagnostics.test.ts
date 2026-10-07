import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ImportRowDiagnostics} from "./import-row-diagnostics";
import {importDiagnostic,normalizeImportDecimal} from "./import-diagnostics";

test("row descriptions display cell, column, original value and correction in both languages",()=>{
 const diagnostic={...importDiagnostic("Event Days","1.5","Enter a whole number from 1 to 365.","أدخل عدداً صحيحاً من ١ إلى ٣٦٥."),cell:"X21"};
 for(const lang of ["en","ar"]){
  const html=renderToStaticMarkup(createElement(ImportRowDiagnostics,{diagnostics:[diagnostic],lang}));
  assert.match(html,/X21 · Event Days/);assert.match(html,/1\.5/);
  assert.ok(html.includes(lang==="ar"?diagnostic.message_ar:diagnostic.message));
 }
 const rounded={...normalizeImportDecimal("Event Attendance Client Price","296890.10000000003").diagnostic!,cell:"W21"};
 const html=renderToStaticMarkup(createElement(ImportRowDiagnostics,{diagnostics:[rounded],lang:"en"}));
 assert.match(html,/W21 · Event Attendance Client Price/);assert.match(html,/Automatically rounded to 296890\.1/);
});
