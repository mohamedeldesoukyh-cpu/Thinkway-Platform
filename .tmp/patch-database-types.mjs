import fs from "node:fs";

const path = "types/database.ts";
let c = fs.readFileSync(path, "utf8");

if (!c.includes("af_pct: number;")) {
  c = c.replace(
    `          gp_value_egp: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quotation_id: string;`,
    `          gp_value_egp: number;
          af_pct: number;
          af_value: number;
          af_value_egp: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quotation_id: string;`
  );
}

if (!c.includes("total_af_egp: number;")) {
  c = c.replace(
    `          total_gp_pct: number;
          notes: string | null;
          terms: string | null;
          prepared_by_name: string | null;
          prepared_by_signature: string | null;`,
    `          total_gp_pct: number;
          total_af_egp: number;
          total_agency_margin_egp: number;
          notes: string | null;
          terms: string | null;
          prepared_by_name: string | null;
          prepared_by_signature: string | null;`
  );
}

fs.writeFileSync(path, c);
console.log("database types patched");
