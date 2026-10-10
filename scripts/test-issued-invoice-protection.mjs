// Runs only in a disposable in-memory PostgreSQL engine; never accepts a database URL.
// Install @electric-sql/pglite in a temporary directory and pass its module file.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : '@electric-sql/pglite');
const db = new PGlite();
const old = '00000000-0000-0000-0000-000000000001';
const fresh = '00000000-0000-0000-0000-000000000002';
await db.exec(`CREATE TABLE invoices (id uuid PRIMARY KEY, status text, issue_date date,
 subtotal numeric, tax_amount numeric, total numeric, amount_paid numeric DEFAULT 0,
 currency text, document_number text, client_id uuid, campaign_header_id uuid,
 billing_country_code text, regeneration_status text);
 CREATE TABLE invoice_line_items (id int PRIMARY KEY, invoice_id uuid REFERENCES invoices(id), revenue_before_vat numeric);
 INSERT INTO invoices(id,status,issue_date,subtotal,tax_amount,total) VALUES
 ('${old}','draft','2026-10-04',525586.15,73582.15,599168.30);
 INSERT INTO invoice_line_items VALUES(1,'${old}',525586.15);`);
await db.exec(await readFile(new URL('../supabase/migrations/20261011010000_protect_issued_invoice_amounts.sql', import.meta.url),'utf8'));
let checks = 0;
async function blocked(sql) {
 await assert.rejects(db.exec(sql), /Issued invoice/); checks++;
}
await blocked(`UPDATE invoices SET subtotal=183561.99 WHERE id='${old}'`);
await blocked(`UPDATE invoices SET tax_amount=25698.68 WHERE id='${old}'`);
await blocked(`UPDATE invoices SET total=209260.67 WHERE id='${old}'`);
await blocked(`UPDATE invoices SET currency='USD' WHERE id='${old}'`);
await blocked(`UPDATE invoices SET amounts_finalized_at=NULL WHERE id='${old}'`);
await blocked(`DELETE FROM invoices WHERE id='${old}'`);
await blocked(`DELETE FROM invoice_line_items WHERE id=1`);
await blocked(`UPDATE invoice_line_items SET revenue_before_vat=1 WHERE id=1`);
await blocked(`INSERT INTO invoice_line_items VALUES(2,'${old}',100)`);
await db.exec(`INSERT INTO invoices(id,status,issue_date) VALUES('${fresh}','draft','2026-10-10');
 INSERT INTO invoice_line_items VALUES(2,'${fresh}',100);
 UPDATE invoices SET subtotal=100,tax_amount=14,total=114 WHERE id='${fresh}';`);
await blocked(`UPDATE invoice_line_items SET invoice_id='${fresh}' WHERE id=1`);
await blocked(`UPDATE invoice_line_items SET invoice_id='${old}' WHERE id=2`);
await db.exec(`UPDATE invoices SET amounts_finalized_at=now() WHERE id='${fresh}'`);
await blocked(`DELETE FROM invoice_line_items WHERE id=2`);
await db.exec(`UPDATE invoices SET status='sent',amount_paid=100 WHERE id='${old}';
 UPDATE invoices SET status='draft',regeneration_status='pending_regeneration' WHERE id='${old}';`);
await blocked(`UPDATE invoices SET subtotal=0 WHERE id='${old}'`);
const { rows } = await db.query(`SELECT subtotal,total,amount_paid FROM invoices WHERE id='${old}'`);
assert.equal(Number(rows[0].subtotal),525586.15);
assert.equal(Number(rows[0].total),599168.30);
assert.equal(Number(rows[0].amount_paid),100);
await db.close();
console.log(`Invoice database protection: ${checks} forbidden mutations blocked; creation, sealing and payment updates passed.`);
