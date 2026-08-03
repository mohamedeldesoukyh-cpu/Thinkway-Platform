import assert from "node:assert/strict";
import test from "node:test";

import { resolveBrandIdByName } from "./resolve-campaign-plan-brand";

type BrandRow = { id: string; name: string };

function fakeSupabase(brands: BrandRow[]) {
  return {
    from(_table: string) {
      const state: { pattern?: string; orFilter?: string } = {};
      const api = {
        select() {
          return api;
        },
        ilike(_col: string, pattern: string) {
          state.pattern = pattern;
          return api;
        },
        or(filter: string) {
          state.orFilter = filter;
          return api;
        },
        limit(_n: number) {
          return api;
        },
        then(resolve: (value: { data: BrandRow[] }) => unknown) {
          let data = brands;
          if (state.pattern) {
            const raw = state.pattern.replace(/%/g, "").toLowerCase();
            const contains = state.pattern.includes("%");
            data = brands.filter((b) => {
              const n = b.name.toLowerCase();
              return contains ? n.includes(raw) : n === raw;
            });
          }
          if (state.orFilter?.includes("E&")) {
            data = brands.filter((b) => /^e&$/i.test(b.name.trim()));
          }
          return Promise.resolve(resolve({ data }));
        },
      };
      return api;
    },
  };
}

test("resolveBrandIdByName matches exact case-insensitive brand", async () => {
  const sb = fakeSupabase([
    { id: "b1", name: "L'Oréal Paris" },
    { id: "b2", name: "Noon" },
  ]) as never;
  const id = await resolveBrandIdByName(sb, "l'oréal paris");
  assert.equal(id, "b1");
});

test("resolveBrandIdByName matches unique fuzzy contains", async () => {
  const sb = fakeSupabase([{ id: "b1", name: "L'Oréal Paris" }]) as never;
  const id = await resolveBrandIdByName(sb, "Oréal");
  assert.equal(id, "b1");
});

test("resolveBrandIdByName matches e& telecom brand", async () => {
  const sb = fakeSupabase([
    { id: "b-eand", name: "E&" },
    { id: "b2", name: "Noon" },
  ]) as never;
  const id = await resolveBrandIdByName(sb, "e&");
  assert.equal(id, "b-eand");
});
