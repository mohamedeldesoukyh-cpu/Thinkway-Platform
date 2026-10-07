import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {normalizeImportDecimal,profileImportDiagnostics} from "./import-diagnostics";
import {validateImportRow,validateWorkbookRow} from "./model";
import {readRateWorkbook} from "./workbook";

const match={ref:"inf:00000000-0000-4000-8000-000000000001",name:"Creator"};
const raw={"Profile URL 1":"https://instagram.com/creator","Package Code":"reel","Package Name":"Reel",Reels:"1",Stories:"0","Package Client Price":"100","Client Currency":"EGP","Creator Currency":"EGP"};
const validate=(changes:Record<string,string>,seen=new Map<string,number>(),row=21)=>validateWorkbookRow(row,{...raw,...changes},match,["EGP"],seen);

test("prices and fees round to nearest four decimal places using exact decimal arithmetic",()=>{
 for(const [input,expected] of [["296890.10000000003","296890.1"],["787698.6741000001","787698.6741"],["116806.04000000001","116806.04"],["1.00005","1.0001"],["1.99995","2"],["1.23444","1.2344"],["0.000049","0"],["5e-5","0.0001"],["1e-7","0"],["1.23455e2","123.455"]]){
  const result=normalizeImportDecimal("Rate",input);assert.equal(result.value,expected);assert.equal(result.diagnostic?.severity,"warning");
 }
 assert.equal(normalizeImportDecimal("Rate","2.5001").diagnostic,undefined);
 const result=validate({"Event Attendance Client Price":"296890.10000000003","Agency Fee %":"10.123456"});
 assert.equal(result.status,"warning");assert.equal(result.rates?.find(r=>r.deliverable==="event_attendance")?.amount,296890.1);
 assert.ok(result.rates?.every(r=>r.agency_fee_percent===10.1235));
 assert.equal(result.diagnostics?.filter(d=>d.column==="Agency Fee %").length,1);
 assert.match(result.diagnostics!.find(d=>d.column==="Event Attendance Client Price")!.message,/296890\.1/);
});
test("row errors identify actual price and period columns, values and required correction",()=>{
 const result=validate({"Package Client Price":"-20","Boosting Monthly Client Price":"abc","Boosting Period (Months)":"1.5","Event Attendance Client Price":"40","Event Days":"1.5"});
 assert.equal(result.status,"error");
 for(const column of ["Package Client Price","Boosting Monthly Client Price","Boosting Period (Months)","Event Days"])assert.ok(result.diagnostics?.some(d=>d.column===column),column);
 assert.match(result.diagnostics!.find(d=>d.column==="Package Client Price")!.message,/Negative/);
 assert.equal(result.diagnostics!.find(d=>d.column==="Event Days")!.value,"1.5");
});
test("invalid rows do not make later valid rows appear duplicate; duplicates name the original row",()=>{
 const seen=new Map<string,number>();
 assert.equal(validate({"Event Attendance Client Price":"bad"},seen,21).status,"error");
 assert.equal(validate({},seen,22).status,"ready");
 const duplicate=validate({},seen,23);assert.equal(duplicate.status,"error");
 assert.match(duplicate.diagnostics![0].message,/row 22/);
});
test("invalid package fields and profile links explain the correction",()=>{
 const result=validate({"Package Code":"bad code","Package Name":"",Stories:"1","Profile URL 1":"https://tiktok.com/@creator"});
 for(const column of ["Package Code","Package Name","Stories"])assert.ok(result.diagnostics?.some(d=>d.column===column),column);
 const links=profileImportDiagnostics({"Profile URL 2":"https://example.com/not-social"});
 assert.equal(links[0].column,"Profile URL 2");assert.match(links[0].message,/profile link/);
 assert.match(validate({"Client Currency":"XYZ"}).diagnostics![0].message,/not active/);
 const individual=validateImportRow(2,{Platform:"instagram","Deliverable Type":"instagram_reel",Rate:"30",Currency:"EGP","Rate Type":"wrong"},match,["EGP"],new Set());
 assert.ok(individual.diagnostics?.some(d=>d.column==="Rate Type"));
});
test("Excel parser preserves exact cell addresses and identifies unsupported formulas",async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Packages");
 sheet.addRow([...Object.keys(raw),"Package Creator Cost"]);sheet.addRow(Object.values(raw));
 sheet.getCell("F2").value={formula:"10+20",result:30};
 const [row]=await readRateWorkbook(await book.xlsx.writeBuffer() as ArrayBuffer);
 assert.equal(row.unsupported,true);assert.deepEqual(row.unsupportedCells,[{column:"Package Client Price",cell:"F2",value:"=10+20",kind:"formula"}]);
 assert.equal(row.cells["Client Currency"],"G2");
});
