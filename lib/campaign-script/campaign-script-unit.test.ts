import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { documentationUnitKey } from "@/lib/services/deliverables/documentation-types";

import {
  canAccessCampaignScriptUnit,
  campaignScriptUnitKey,
  decideDocumentationScriptUnitGrain,
  isQtyOneDocumentationScriptUnit,
  parseCampaignScriptDocumentationUnit,
} from "./unit";
import { loadCampaignScriptById, loadCampaignScriptForUnit, loadCampaignScriptMaster } from "./load-master";
import { saveCampaignScriptForUnit, saveCampaignScriptMaster } from "./save-master";
import { shouldQueueTranslationAfterSave } from "./translation-policy";
import { mergeExtractedScriptText } from "./language";

const HEADER = "campaign-1";
const DELIVERABLE_REEL = "del-reel-1";
const DELIVERABLE_STORY = "del-story-1";
const DELIVERABLE_REEL_B = "del-reel-2";
const POST_STORY_1 = "post-story-1";
const POST_STORY_2 = "post-story-2";

type ScriptRow = Database["public"]["Tables"]["campaign_scripts"]["Row"];
type RevisionRow = Database["public"]["Tables"]["campaign_script_revisions"]["Row"];
type DeliverableRow = { id: string; campaign_header_id: string; quantity: number };
type PostRow = { id: string; assignment_deliverable_id: string };

type MemoryDb = {
  scripts: ScriptRow[];
  revisions: RevisionRow[];
  deliverables: DeliverableRow[];
  posts: PostRow[];
};

function iso(n = 0): string {
  return new Date(Date.UTC(2026, 7, 29, 12, 0, n)).toISOString();
}

function matchesFilters(
  row: Record<string, unknown>,
  filters: Array<{ type: "eq" | "in" | "is"; key: string; value: unknown }>
): boolean {
  return filters.every((filter) => {
    const actual = row[filter.key];
    if (filter.type === "eq") return actual === filter.value;
    if (filter.type === "in") return Array.isArray(filter.value) && filter.value.includes(actual);
    if (filter.value === null) return actual == null;
    return actual === filter.value;
  });
}

function createMemoryDb(): MemoryDb {
  return {
    scripts: [],
    revisions: [],
    deliverables: [
      { id: DELIVERABLE_REEL, campaign_header_id: HEADER, quantity: 1 },
      { id: DELIVERABLE_REEL_B, campaign_header_id: HEADER, quantity: 1 },
      { id: DELIVERABLE_STORY, campaign_header_id: HEADER, quantity: 2 },
    ],
    posts: [
      { id: POST_STORY_1, assignment_deliverable_id: DELIVERABLE_STORY },
      { id: POST_STORY_2, assignment_deliverable_id: DELIVERABLE_STORY },
    ],
  };
}

function createMemorySupabase(db: MemoryDb): SupabaseClient<Database> {
  const from = (table: string) => {
    const filters: Array<{ type: "eq" | "in" | "is"; key: string; value: unknown }> = [];
    let payload: Record<string, unknown> | null = null;
    let op: "select" | "insert" | "update" = "select";
    let orderBy: { key: string; ascending: boolean } | null = null;

    const api = {
      select() {
        return api;
      },
      insert(row: Record<string, unknown>) {
        op = "insert";
        payload = row;
        return api;
      },
      update(row: Record<string, unknown>) {
        op = "update";
        payload = row;
        return api;
      },
      eq(key: string, value: unknown) {
        filters.push({ type: "eq", key, value });
        return api;
      },
      in(key: string, value: unknown[]) {
        filters.push({ type: "in", key, value });
        return api;
      },
      is(key: string, value: unknown) {
        filters.push({ type: "is", key, value });
        return api;
      },
      order(key: string, options?: { ascending?: boolean }) {
        orderBy = { key, ascending: options?.ascending !== false };
        return api;
      },
      limit() {
        return api;
      },
      async maybeSingle() {
        const many = await executeMany();
        if (many.error) return many;
        const rows = many.data ?? [];
        return { data: rows[0] ?? null, error: null };
      },
      then(
        resolveResult: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown
      ) {
        return executeMany().then(resolveResult, reject);
      },
    };

    async function executeMany(): Promise<{
      data: unknown;
      error: { code?: string; message: string } | null;
    }> {
      if (table === "assignment_deliverables") {
        return { data: db.deliverables.filter((row) => matchesFilters(row, filters)), error: null };
      }
      if (table === "assignment_post_schedule") {
        return { data: db.posts.filter((row) => matchesFilters(row, filters)), error: null };
      }
      if (table === "campaign_scripts") {
        if (op === "insert" && payload) {
          const deliverableId = (payload.assignment_deliverable_id as string | null) ?? null;
          const postId = (payload.assignment_post_schedule_id as string | null) ?? null;
          const duplicate = db.scripts.some((row) => {
            if (deliverableId == null && postId == null) {
              return (
                row.campaign_header_id === payload?.campaign_header_id &&
                row.assignment_deliverable_id == null &&
                row.assignment_post_schedule_id == null
              );
            }
            if (postId) return row.assignment_post_schedule_id === postId;
            return (
              row.assignment_deliverable_id === deliverableId &&
              row.assignment_post_schedule_id == null
            );
          });
          if (duplicate) return { data: null, error: { code: "23505", message: "duplicate" } };
          const row: ScriptRow = {
            id: `script-${db.scripts.length + 1}`,
            campaign_header_id: String(payload.campaign_header_id),
            current_revision_id: null,
            source_language: payload.source_language === "ar" ? "ar" : "en",
            status: "current",
            origin: payload.origin === "client" ? "client" : "internal",
            created_at: iso(db.scripts.length + 1),
            updated_at: iso(db.scripts.length + 1),
            translation_status: "idle",
            translation_target_language: null,
            translation_source_revision_id: null,
            translation_error: null,
            translation_attempts: 0,
            translation_updated_at: null,
            assignment_deliverable_id: deliverableId,
            assignment_post_schedule_id: postId,
          };
          db.scripts.push(row);
          return { data: [row], error: null };
        }
        if (op === "update" && payload) {
          const current = db.scripts.filter((row) => matchesFilters(row, filters));
          const target = current[0];
          if (!target) return { data: [], error: null };
          Object.assign(target, payload);
          return { data: [target], error: null };
        }
        return { data: db.scripts.filter((row) => matchesFilters(row, filters)), error: null };
      }
      if (table === "campaign_script_revisions") {
        if (op === "insert" && payload) {
          const duplicate = db.revisions.some(
            (row) =>
              row.script_id === payload?.script_id && row.revision_number === payload.revision_number
          );
          if (duplicate) return { data: null, error: { code: "23505", message: "duplicate" } };
          const row: RevisionRow = {
            id: `rev-${db.revisions.length + 1}`,
            script_id: String(payload.script_id),
            campaign_header_id: String(payload.campaign_header_id),
            revision_number: Number(payload.revision_number),
            business_version: String(payload.business_version),
            body_en: String(payload.body_en ?? ""),
            body_ar: String(payload.body_ar ?? ""),
            source_language: payload.source_language === "ar" ? "ar" : "en",
            en_origin:
              payload.en_origin === "generated" || payload.en_origin === "human_edited"
                ? payload.en_origin
                : "source",
            ar_origin:
              payload.ar_origin === "source" || payload.ar_origin === "human_edited"
                ? payload.ar_origin
                : "generated",
            actor_kind: payload.actor_kind === "client" ? "client" : "internal",
            actor_user_id: (payload.actor_user_id as string | null) ?? null,
            actor_label: (payload.actor_label as string | null) ?? null,
            parent_revision_id: (payload.parent_revision_id as string | null) ?? null,
            review_id: (payload.review_id as string | null) ?? null,
            original_file_name: (payload.original_file_name as string | null) ?? null,
            change_summary: (payload.change_summary as string | null) ?? null,
            created_at: iso(db.revisions.length + 2),
            assignment_id: null,
          };
          db.revisions.push(row);
          return { data: [row], error: null };
        }
        const rows = db.revisions.filter((row) => matchesFilters(row, filters));
        if (orderBy) {
          const key = orderBy.key as keyof RevisionRow;
          rows.sort((a, b) => {
            const av = a[key];
            const bv = b[key];
            if (av === bv) return 0;
            const cmp = av > bv ? 1 : -1;
            return orderBy?.ascending ? cmp : -cmp;
          });
        }
        return { data: rows, error: null };
      }
      return { data: null, error: { message: `unknown table ${table}` } };
    }

    return api;
  };

  return { from } as unknown as SupabaseClient<Database>;
}

function saveInput(
  unit: { assignmentDeliverableId: string; assignmentPostScheduleId?: string | null },
  bodyEn: string,
  expectedCurrentRevisionId: string | null = null
) {
  return {
    campaignHeaderId: HEADER,
    expectedCurrentRevisionId,
    unit,
    sourceLanguage: "en" as const,
    bodyEn,
    bodyAr: "",
    actorKind: "internal" as const,
    actorUserId: null,
    actorLabel: "Mona",
    origin: "internal" as const,
  };
}

test("documentation unit keys match the existing d: / p: grain", () => {
  assert.equal(campaignScriptUnitKey(DELIVERABLE_REEL, null), documentationUnitKey(DELIVERABLE_REEL, null));
  assert.equal(campaignScriptUnitKey(DELIVERABLE_STORY, POST_STORY_1), documentationUnitKey(DELIVERABLE_STORY, POST_STORY_1));
  assert.equal(campaignScriptUnitKey(DELIVERABLE_REEL, null), `d:${DELIVERABLE_REEL}`);
  assert.equal(campaignScriptUnitKey(DELIVERABLE_STORY, POST_STORY_1), `p:${POST_STORY_1}`);
  assert.equal(decideDocumentationScriptUnitGrain({ quantity: 1, assignmentPostScheduleId: null }), "qty1");
  assert.equal(
    decideDocumentationScriptUnitGrain({ quantity: 2, assignmentPostScheduleId: POST_STORY_1 }),
    "qty_n"
  );
  assert.equal(decideDocumentationScriptUnitGrain({ quantity: 1, assignmentPostScheduleId: POST_STORY_1 }), "invalid");
  assert.equal(decideDocumentationScriptUnitGrain({ quantity: 3, assignmentPostScheduleId: null }), "invalid");
  const qty1 = parseCampaignScriptDocumentationUnit({
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL,
  });
  assert.equal("ok" in qty1, false);
  if ("ok" in qty1) return;
  assert.equal(isQtyOneDocumentationScriptUnit(qty1), true);
});

test("qty=1 unit gets its own script; missing unit stays sparse", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const missing = await loadCampaignScriptForUnit(supabase, {
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL,
  });
  assert.equal(missing, null);
  assert.equal(db.scripts.length, 0);

  const saved = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "Reel 1 script")
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.script.assignmentDeliverableId, DELIVERABLE_REEL);
  assert.equal(saved.script.assignmentPostScheduleId, null);
  assert.equal(saved.script.bodyEn, "Reel 1 script");
  assert.equal(db.scripts.length, 1);
});

test("qty>1 post unit gets its own script", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const saved = await saveCampaignScriptForUnit(
    supabase,
    saveInput(
      { assignmentDeliverableId: DELIVERABLE_STORY, assignmentPostScheduleId: POST_STORY_1 },
      "Story 1 script"
    )
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.script.assignmentPostScheduleId, POST_STORY_1);
  const loaded = await loadCampaignScriptForUnit(supabase, {
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_STORY,
    assignmentPostScheduleId: POST_STORY_1,
  });
  assert.equal(loaded?.bodyEn, "Story 1 script");
});

test("same creator can have independent scripts on multiple units", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const reel = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "Creator A reel")
  );
  const story = await saveCampaignScriptForUnit(
    supabase,
    saveInput(
      { assignmentDeliverableId: DELIVERABLE_STORY, assignmentPostScheduleId: POST_STORY_1 },
      "Creator A story"
    )
  );
  assert.equal(reel.ok && story.ok, true);
  if (!reel.ok || !story.ok) return;
  assert.notEqual(reel.script.scriptId, story.script.scriptId);
  assert.equal(db.scripts.length, 2);
});

test("updating one unit does not change another unit", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const first = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "Reel A v1")
  );
  const second = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL_B }, "Reel B v1")
  );
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;

  const updated = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "Reel A v2", first.script.currentRevisionId)
  );
  assert.equal(updated.ok, true);
  const reelB = await loadCampaignScriptForUnit(supabase, {
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL_B,
  });
  assert.equal(reelB?.bodyEn, "Reel B v1");
  assert.equal(reelB?.currentRevisionId, second.script.currentRevisionId);
});

test("revisions stay isolated per unit script", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const a = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "A1")
  );
  assert.equal(a.ok, true);
  if (!a.ok) return;
  const a2 = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "A2", a.script.currentRevisionId)
  );
  const b = await saveCampaignScriptForUnit(
    supabase,
    saveInput(
      { assignmentDeliverableId: DELIVERABLE_STORY, assignmentPostScheduleId: POST_STORY_1 },
      "B1"
    )
  );
  assert.equal(a2.ok && b.ok, true);
  if (!a2.ok || !b.ok) return;
  assert.equal(a2.script.revisionNumber, 2);
  assert.equal(b.script.revisionNumber, 1);
  assert.equal(
    db.revisions.filter((row) => row.script_id === a.script.scriptId).length,
    2
  );
  assert.equal(
    db.revisions.filter((row) => row.script_id === b.script.scriptId).length,
    1
  );
});

test("translation state and save-by-scriptId stay on the same unit", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const a = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "English reel")
  );
  const b = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL_B }, "English other")
  );
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.deepEqual(shouldQueueTranslationAfterSave(), { queue: false });

  const translated = await saveCampaignScriptMaster(supabase, {
    campaignHeaderId: HEADER,
    scriptId: a.script.scriptId,
    expectedCurrentRevisionId: a.script.currentRevisionId,
    sourceLanguage: "en",
    bodyEn: "English reel",
    bodyAr: "نص عربي",
    actorKind: "internal",
    actorUserId: null,
    actorLabel: "Thinkway",
    origin: "internal",
    bumpBusinessVersion: false,
    originsOverride: { enOrigin: "source", arOrigin: "generated" },
  });
  assert.equal(translated.ok, true);
  const other = await loadCampaignScriptById(supabase, b.script.scriptId);
  assert.equal(other?.bodyAr, "");
  assert.equal(other?.bodyEn, "English other");
});

test("upload merge applies only to the target unit script", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const a = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "English A")
  );
  const b = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL_B }, "English B")
  );
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  const merged = mergeExtractedScriptText({
    extractedText: "English A uploaded",
    sourceLanguage: "en",
    existingBodyEn: a.script.bodyEn,
    existingBodyAr: "Arabic kept",
  });
  const saved = await saveCampaignScriptForUnit(supabase, {
    ...saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, merged.bodyEn, a.script.currentRevisionId),
    bodyAr: merged.bodyAr,
  });
  assert.equal(saved.ok, true);
  const other = await loadCampaignScriptForUnit(supabase, {
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL_B,
  });
  assert.equal(other?.bodyEn, "English B");
});

test("second save on the same unit reuses one script row", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const first = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "First")
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "Second", first.script.currentRevisionId)
  );
  assert.equal(second.ok, true);
  assert.equal(db.scripts.length, 1);
  assert.equal(db.scripts[0]?.id, first.script.scriptId);
});

test("concurrent first save on the same unit does not create two scripts", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const first = saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "One")
  );
  const second = saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "Two")
  );
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.ok || b.ok, true);
  assert.equal(db.scripts.length, 1);
});

test("legacy unattached campaign script is not used as a unit script", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const legacy = await saveCampaignScriptMaster(supabase, {
    campaignHeaderId: HEADER,
    expectedCurrentRevisionId: null,
    sourceLanguage: "en",
    bodyEn: "Legacy campaign script",
    bodyAr: "",
    actorKind: "internal",
    actorUserId: null,
    actorLabel: "Mona",
    origin: "internal",
  });
  assert.equal(legacy.ok, true);
  const unit = await loadCampaignScriptForUnit(supabase, {
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL,
  });
  assert.equal(unit, null);
  const loadedLegacy = await loadCampaignScriptMaster(supabase, HEADER);
  assert.equal(loadedLegacy?.bodyEn, "Legacy campaign script");
  assert.equal(loadedLegacy?.assignmentDeliverableId, null);
});

test("qty=1 cannot attach to a post; qty>1 requires a post", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const qty1OnPost = await saveCampaignScriptForUnit(
    supabase,
    saveInput(
      { assignmentDeliverableId: DELIVERABLE_REEL, assignmentPostScheduleId: POST_STORY_1 },
      "wrong grain"
    )
  );
  assert.equal(qty1OnPost.ok, false);
  const qtyNWithoutPost = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_STORY }, "missing post")
  );
  assert.equal(qtyNWithoutPost.ok, false);
});

test("stale CAS on a unit script does not write", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const first = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "v1")
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "v2", first.script.currentRevisionId)
  );
  const stale = await saveCampaignScriptForUnit(
    supabase,
    saveInput({ assignmentDeliverableId: DELIVERABLE_REEL }, "stale", first.script.currentRevisionId)
  );
  assert.equal(stale.ok, false);
  if (stale.ok) return;
  assert.equal(stale.conflict, true);
  const loaded = await loadCampaignScriptForUnit(supabase, {
    campaignHeaderId: HEADER,
    assignmentDeliverableId: DELIVERABLE_REEL,
  });
  assert.equal(loaded?.bodyEn, "v2");
});

test("RLS helper and unit migration SQL keep internal campaign access", () => {
  assert.equal(
    canAccessCampaignScriptUnit({
      operation: "select",
      hasCampaignsRead: true,
      hasCampaignsWrite: false,
      canAccessCampaignHeader: true,
    }),
    true
  );
  assert.equal(
    canAccessCampaignScriptUnit({
      operation: "insert",
      hasCampaignsRead: true,
      hasCampaignsWrite: true,
      canAccessCampaignHeader: true,
    }),
    true
  );
  assert.equal(
    canAccessCampaignScriptUnit({
      operation: "select",
      hasCampaignsRead: true,
      hasCampaignsWrite: true,
      canAccessCampaignHeader: true,
      isClientContentToken: true,
    }),
    false
  );
  const sql = readFileSync(
    resolve("supabase/migrations/20260829140000_campaign_script_documentation_units.sql"),
    "utf8"
  );
  assert.match(sql, /campaign_scripts_qty1_unit_idx/);
  assert.match(sql, /campaign_scripts_qty_n_unit_idx/);
  assert.match(sql, /campaign_scripts_legacy_unattached_idx/);
  assert.match(sql, /DROP INDEX IF EXISTS public.campaign_scripts_header_idx/);
  assert.match(sql, /deliverable_quantity = 1 AND NEW.assignment_post_schedule_id IS NOT NULL/);
  assert.match(sql, /deliverable_quantity > 1 AND NEW.assignment_post_schedule_id IS NULL/);
  assert.equal(/ALTER TABLE public\.campaign_script_assignments/.test(sql), false);
  assert.equal(/DROP TABLE public\.campaign_script_assignments/.test(sql), false);
});
