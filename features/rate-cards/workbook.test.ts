import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { buildRateTemplate, readRateWorkbook } from "./workbook";
import {rateImportIdentity} from "./import-identity";
import {validateWorkbookRow} from "./model";
test("All Platforms is listed and accepts a generic reel price",async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildRateTemplate(["EGP"]));
 assert.equal(book.getWorksheet("Lists")!.getCell("A1").value,"all");
 const row=validateWorkbookRow(2,{Platform:"All Platforms","Deliverable Type":"reel","Client Selling Price":"100","Client Currency":"EGP"},{ref:"inf:00000000-0000-4000-8000-000000000001",name:"Creator"},["EGP"],new Set());
 assert.equal(row.status,"ready");assert.equal(row.rate?.platform,"all");
});
test("URL and prices alone support Excel hyperlinks and inferred platform",async()=>{
 const book=new ExcelJS.Workbook();const sheet=book.addWorksheet("Rates");
 sheet.addRow(["Profile URL","Deliverable Type","Creator Cost","Creator Currency"]);
 sheet.addRow([{text:"Creator",hyperlink:"https://instagram.com/creator/"},"instagram_reel",100,"EGP"]);
 const rows=await readRateWorkbook(await book.xlsx.writeBuffer());assert.equal(rows[0].unsupported,false);
 const identity=rateImportIdentity(rows[0].raw);assert.equal(identity.platform,"instagram");
 const validated=validateWorkbookRow(2,{...rows[0].raw,Platform:identity.platform!},{ref:"inf:00000000-0000-4000-8000-000000000001",name:"Creator"},["EGP"],new Set());
 assert.equal(validated.status,"ready");assert.equal(validated.rate?.amount,100);
});
test("Excel template round-trips zero and decimal rates and includes validations",async()=>{
 const bytes=await buildRateTemplate(["EGP","USD"]);const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);const sheet=book.getWorksheet("Rates")!;
 assert.equal(sheet.getCell("G2").dataValidation.type,"list");assert.equal(sheet.getCell("H2").dataValidation.type,"list");assert.equal(sheet.getCell("J5001").dataValidation.type,"list");
 sheet.getRow(2).values=["","Creator","inf:00000000-0000-4000-8000-000000000001","","","","instagram","instagram_reel",0,"EGP"];
 sheet.getRow(3).values=["","Creator","inf:00000000-0000-4000-8000-000000000001","","","","instagram","instagram_story",12.25,"USD"];
 const result=await readRateWorkbook(await book.xlsx.writeBuffer());assert.equal(result.length,2);assert.equal(result[0].raw["Creator Cost"],"0");assert.equal(result[1].raw["Creator Cost"],"12.25");
});
test("formula rows are visible errors, never silently skipped or executed",async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildRateTemplate(["EGP"]));book.getWorksheet("Rates")!.getCell("I2").value={formula:"1+1",result:2};
 const result=await readRateWorkbook(await book.xlsx.writeBuffer());assert.equal(result.length,1);assert.equal(result[0].unsupported,true);
});
test("blank and malformed workbooks fail before import",async()=>{
 await assert.rejects(()=>readRateWorkbook(new ArrayBuffer(0)));
 await assert.rejects(()=>buildRateTemplate([]));
 await assert.rejects(()=>buildRateTemplate(["EGP"]).then(readRateWorkbook));
});
test("large template preserves all 5000 rows and rejects a row beyond the limit",async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildRateTemplate(["EGP"]));const sheet=book.getWorksheet("Rates")!;
 for(let n=2;n<=5001;n++)sheet.getRow(n).values=["","Creator "+n,"","creator"+n,"","","instagram","instagram_reel",n,"EGP",n*2,"EGP","","",10];
 const rows=await readRateWorkbook(await book.xlsx.writeBuffer());assert.equal(rows.length,5000);assert.equal(rows.at(-1)!.row,5001);assert.equal(rows.at(-1)!.raw["Client Selling Price"],"10002");
 sheet.getCell("A5002").value="Overflow";await assert.rejects(()=>book.xlsx.writeBuffer().then(readRateWorkbook),/file/);
});
