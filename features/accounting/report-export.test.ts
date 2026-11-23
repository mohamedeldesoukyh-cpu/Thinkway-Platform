import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {reportExcel,reportWord} from './report-export-server';
import {formattedReportHtml,type FormattedReport} from './formatted-report-model';
import {reportAmount} from './report-number';
const report:FormattedReport={company:'TW <safe>',title:'Statement',caption:'2026 EGP',sections:[{heading:'112001 Main bank',columns:['Code','Description','Debit'],rows:[['001234','=HYPERLINK("unsafe")','123.45']]},{heading:'112002 USD bank',columns:['Code','Credit'],rows:[['001235','-10.00']]}]};
test('Excel keeps codes as text, amounts numeric and text formulas inert',async()=>{const bytes=await reportExcel(report);const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as any);assert.equal(book.worksheets.length,2);assert.equal(book.worksheets[0].getCell('A5').value,'001234');assert.equal(book.worksheets[0].getCell('B5').value,'=HYPERLINK("unsafe")');assert.equal(book.worksheets[0].getCell('C5').value,123.45);assert.equal(book.worksheets[1].getCell('B5').value,-10);});
test('Word is a real OOXML package with separate report pages and escaped text',async()=>{const bytes=await reportWord(report);const zip=await JSZip.loadAsync(bytes);assert.ok(zip.file('[Content_Types].xml'));assert.ok(zip.file('_rels/.rels'));const xml=await zip.file('word/document.xml')!.async('string');assert.ok(xml.includes('TW &lt;safe&gt;'));assert.ok(xml.includes('112001 Main bank'));assert.ok(xml.includes('112002 USD bank'));assert.equal((xml.match(/<w:type w:val="nextPage"/g)||[]).length,1);assert.ok(xml.includes('<w:tblGrid>'));});
test('Formatted preview escapes report text and keeps page breaks',()=>{const html=formattedReportHtml(report);assert.ok(html.includes('TW &lt;safe&gt;'));assert.equal((html.match(/<section class="page landscape">/g)||[]).length,2);assert.ok(html.includes('break-before:page'));});

test('Preview and Word format amounts without changing codes or signature text',async()=>{
 assert.equal(reportAmount('2469135.78'),'2,469,135.78');
 assert.equal(reportAmount('0'),'0.00');
 assert.equal(reportAmount('-1234.5'),'-1,234.50');
 assert.equal(reportAmount('999999999999999.99'),'999,999,999,999,999.99');
 assert.equal(reportAmount('________________'),'________________');
 const value:FormattedReport={...report,sections:[{heading:'Amounts',columns:['Account','Debit','Credit'],rows:[['001234','2469135.78','0'],['000002','0','-1234.5']]}]};
 const html=formattedReportHtml(value);assert.ok(html.includes('>001234</td>'));assert.ok(html.includes('>2,469,135.78</td>'));assert.ok(html.includes('>0.00</td>'));assert.ok(html.includes('num negative">-1,234.50'));
 const zip=await JSZip.loadAsync(await reportWord(value));const xml=await zip.file('word/document.xml')!.async('string');assert.ok(xml.includes('2,469,135.78'));assert.ok(xml.includes('001234'));
});

test('Word and Excel retain portrait voucher and landscape JV orientations',async()=>{const mixed:FormattedReport={...report,sections:report.sections.map((s,i)=>({...s,orientation:i?'landscape':'portrait'}))};const zip=await JSZip.loadAsync(await reportWord(mixed));const xml=await zip.file('word/document.xml')!.async('string');assert.ok(xml.includes('w:orient="portrait"'));assert.ok(xml.includes('w:orient="landscape"'));const book=new ExcelJS.Workbook();await book.xlsx.load(await reportExcel(mixed) as any);assert.equal(book.worksheets[0].pageSetup.orientation,'portrait');assert.equal(book.worksheets[1].pageSetup.orientation,'landscape');});

test('settled amounts stay numeric in Excel and negative amounts are red and aligned in Word',async()=>{
 const value:FormattedReport={...report,sections:[{heading:'Unsettled',columns:['Invoice','Settled','Outstanding'],rows:[['000012','1234.50','-25.25']]}]};
 const book=new ExcelJS.Workbook();await book.xlsx.load(await reportExcel(value) as any);
 assert.equal(book.worksheets[0].getCell('B5').value,1234.5);
 const zip=await JSZip.loadAsync(await reportWord(value));const xml=await zip.file('word/document.xml')!.async('string');
 assert.ok(xml.includes('w:color w:val="B42338"'));assert.ok(xml.includes('w:jc w:val="right"'));assert.ok(xml.includes('1,234.50'));
});
