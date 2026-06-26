import fs from "node:fs";

const path = "types/database.ts";
let out = fs.readFileSync(path, "utf8");

if (!out.includes("total_af_egp")) {
  out = out.replace(
    "total_gp_pct: number;\r\n          notes: string | null;",
    "total_gp_pct: number;\r\n          total_af_egp: number;\r\n          total_agency_margin_egp: number;\r\n          notes: string | null;"
  );
  out = out.replace(
    "total_gp_pct?: number;\r\n          notes?: string | null;",
    "total_gp_pct?: number;\r\n          total_af_egp?: number;\r\n          total_agency_margin_egp?: number;\r\n          notes?: string | null;"
  );
}

if (!out.includes("af_pct: number")) {
  out = out.replace(
    "gp_value_egp: number;\r\n          sort_order: number;\r\n          created_at: string;\r\n          updated_at: string;\r\n        };\r\n        Insert: {\r\n          id?: string;\r\n          quotation_id: string;",
    "gp_value_egp: number;\r\n          af_pct: number;\r\n          af_value: number;\r\n          af_value_egp: number;\r\n          sort_order: number;\r\n          created_at: string;\r\n          updated_at: string;\r\n        };\r\n        Insert: {\r\n          id?: string;\r\n          quotation_id: string;"
  );
  out = out.replace(
    "gp_value_egp?: number;\r\n          sort_order?: number;",
    "gp_value_egp?: number;\r\n          af_pct?: number;\r\n          af_value?: number;\r\n          af_value_egp?: number;\r\n          sort_order?: number;"
  );
}

fs.writeFileSync(path, out);
console.log("patched", out.includes("af_pct: number"));
