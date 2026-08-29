import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  canAccessCampaignScriptAssignment,
  classifyApplyInsertConflict,
  creatorScriptStatusView,
  decideApplyMasterOutcome,
  decideCustomizeAssignment,
  decideReapplyMaster,
  expandLineParticipationsToCreators,
  previewApplyMasterScript,
  resolveEffectiveScript,
  scriptAssignmentAlignment,
  classifyApplyCampaignScriptLineItems,
} from "./assignment-policy";
import {
  applyMasterScriptToLineIds,
  customizeCampaignScriptAssignment,
  listCampaignScriptParticipationsForLines,
  reapplyMasterToCampaignScriptAssignment,
} from "./assignments";
import { campaignScriptTranslateJobId } from "./translation-job";
import { shouldQueueTranslationAfterSave } from "./translation-policy";
import { saveCampaignScriptOverride } from "./save-override";
import { loadCreatorCampaignScript } from "./load-creator-script";
import type { CampaignScriptAssignmentRecord } from "./types";

const HEADER = "campaign-1";
const SCRIPT = "script-1";
const MASTER_REV = "rev-master-1";
const MASTER_REV_2 = "rev-master-2";
const LINE_1 = "line-1";
const LINE_2 = "line-2";
const CREATOR_A = "creator-a";
const CREATOR_B = "creator-b";
const CREATOR_C = "creator-c";
const CI_A1 = "ci-a-1";
const CI_B1 = "ci-b-1";
const CI_A2 = "ci-a-2";
const CI_C2 = "ci-c-2";

type InfluencerLink = {
  id: string;
  campaign_header_id: string;
  campaign_line_id: string | null;
  influencer_id: string;
};

type ScriptRow = Database["public"]["Tables"]["campaign_scripts"]["Row"];
type RevisionRow = Database["public"]["Tables"]["campaign_script_revisions"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["campaign_script_assignments"]["Row"];

type MemoryDb = {
  script: ScriptRow;
  revisions: RevisionRow[];
  assignments: AssignmentRow[];
  influencers: InfluencerLink[];
};

function iso(n = 0): string {
  return new Date(Date.UTC(2026, 7, 29, 0, 0, n)).toISOString();
}

function masterScript(revisionId = MASTER_REV): ScriptRow {
  return {
    id: SCRIPT,
    campaign_header_id: HEADER,
    current_revision_id: revisionId,
    source_language: "en",
    status: "current",
    origin: "internal",
    created_at: iso(),
    updated_at: iso(),
    translation_status: "idle",
    translation_target_language: null,
    translation_source_revision_id: null,
    translation_error: null,
    translation_attempts: 0,
    translation_updated_at: null,
    assignment_deliverable_id: null,
    assignment_post_schedule_id: null,
  };
}

function masterRevision(id = MASTER_REV, number = 1, bodyEn = "Create a 30-second Instagram Reel."): RevisionRow {
  return {
    id,
    script_id: SCRIPT,
    campaign_header_id: HEADER,
    revision_number: number,
    business_version: number === 1 ? "v1" : "v1.1",
    body_en: bodyEn,
    body_ar: "",
    source_language: "en",
    en_origin: "source",
    ar_origin: "generated",
    actor_kind: "internal",
    actor_user_id: null,
    actor_label: "Mona",
    parent_revision_id: number === 1 ? null : MASTER_REV,
    review_id: null,
    original_file_name: null,
    change_summary: null,
    created_at: iso(number),
    assignment_id: null,
  };
}

function packageInfluencers(): InfluencerLink[] {
  return [
    { id: CI_A1, campaign_header_id: HEADER, campaign_line_id: LINE_1, influencer_id: CREATOR_A },
    { id: CI_B1, campaign_header_id: HEADER, campaign_line_id: LINE_1, influencer_id: CREATOR_B },
    { id: CI_A2, campaign_header_id: HEADER, campaign_line_id: LINE_2, influencer_id: CREATOR_A },
    { id: CI_C2, campaign_header_id: HEADER, campaign_line_id: LINE_2, influencer_id: CREATOR_C },
  ];
}

function createMemoryDb(): MemoryDb {
  return {
    script: masterScript(),
    revisions: [masterRevision()],
    assignments: [],
    influencers: packageInfluencers(),
  };
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

function createMemorySupabase(db: MemoryDb): SupabaseClient<Database> {
  const from = (table: string) => {
    const filters: Array<{ type: "eq" | "in" | "is"; key: string; value: unknown }> = [];
    let payload: Record<string, unknown> | null = null;
    let op: "select" | "insert" | "update" = "select";
    let orderBy: { key: string; ascending: boolean } | null = null;

    const applyAssignmentFilters = () => db.assignments.filter((row) => matchesFilters(row, filters));

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
      then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
        return executeMany().then(resolve, reject);
      },
    };

    async function executeMany(): Promise<{ data: unknown; error: { code?: string; message: string } | null }> {
      if (table === "campaign_scripts") {
        if (op !== "select") return { data: null, error: { message: "unsupported" } };
        const rows = matchesFilters(db.script, filters) ? [db.script] : [];
        return { data: rows, error: null };
      }

      if (table === "campaign_script_revisions") {
        if (op === "insert" && payload) {
          const duplicate = db.revisions.some(
            (row) => row.script_id === payload?.script_id && row.revision_number === payload.revision_number
          );
          if (duplicate) {
            return { data: null, error: { code: "23505", message: "duplicate" } };
          }
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
            assignment_id: (payload.assignment_id as string | null) ?? null,
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

      if (table === "campaign_influencers") {
        const rows = db.influencers.filter((row) => matchesFilters(row, filters));
        return { data: rows, error: null };
      }

      if (table === "campaign_script_assignments") {
        if (op === "insert" && payload) {
          const duplicate = db.assignments.some(
            (row) => row.script_id === payload?.script_id && row.influencer_id === payload.influencer_id
          );
          if (duplicate) {
            return { data: null, error: { code: "23505", message: "duplicate key value" } };
          }
          const row: AssignmentRow = {
            id: `asg-${payload.influencer_id}`,
            campaign_header_id: String(payload.campaign_header_id),
            script_id: String(payload.script_id),
            campaign_line_id: (payload.campaign_line_id as string | null) ?? null,
            influencer_id: String(payload.influencer_id),
            campaign_influencer_id: (payload.campaign_influencer_id as string | null) ?? null,
            mode: payload.mode === "customized" ? "customized" : "inherited",
            override_revision_id: (payload.override_revision_id as string | null) ?? null,
            forked_from_master_revision_id:
              (payload.forked_from_master_revision_id as string | null) ?? null,
            assigned_at: iso(db.assignments.length + 1),
            assigned_by: (payload.assigned_by as string | null) ?? null,
            updated_at: iso(db.assignments.length + 1),
            translation_status: "idle",
            translation_target_language: null,
            translation_source_revision_id: null,
            translation_error: null,
            translation_attempts: 0,
            translation_updated_at: null,
          };
          db.assignments.push(row);
          return { data: [row], error: null };
        }
        if (op === "update" && payload) {
          const current = applyAssignmentFilters();
          const target = current[0];
          if (!target) return { data: [], error: null };
          Object.assign(target, payload);
          return { data: [target], error: null };
        }
        return { data: applyAssignmentFilters(), error: null };
      }

      return { data: null, error: { message: `unknown table ${table}` } };
    }

    return api;
  };

  return { from } as unknown as SupabaseClient<Database>;
}

function assignmentRecord(row: AssignmentRow): CampaignScriptAssignmentRecord {
  return {
    id: row.id,
    campaignHeaderId: row.campaign_header_id,
    scriptId: row.script_id,
    campaignLineId: row.campaign_line_id,
    influencerId: row.influencer_id,
    campaignInfluencerId: row.campaign_influencer_id,
    mode: row.mode,
    overrideRevisionId: row.override_revision_id,
    forkedFromMasterRevisionId: row.forked_from_master_revision_id,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    updatedAt: row.updated_at,
    translationStatus: row.translation_status,
    translationTargetLanguage: row.translation_target_language,
    translationSourceRevisionId: row.translation_source_revision_id,
    translationError: row.translation_error,
    translationAttempts: row.translation_attempts,
    translationUpdatedAt: row.translation_updated_at,
  };
}

test("expands selected campaign lines to unique creator participations", () => {
  const unique = expandLineParticipationsToCreators([
    { campaignInfluencerId: CI_A1, campaignLineId: LINE_1, influencerId: CREATOR_A },
    { campaignInfluencerId: CI_B1, campaignLineId: LINE_1, influencerId: CREATOR_B },
    { campaignInfluencerId: CI_A2, campaignLineId: LINE_2, influencerId: CREATOR_A },
    { campaignInfluencerId: CI_C2, campaignLineId: LINE_2, influencerId: CREATOR_C },
    { campaignInfluencerId: "orphan", campaignLineId: null, influencerId: "x" },
  ]);
  assert.deepEqual(
    unique.map((row) => row.influencerId),
    [CREATOR_A, CREATOR_B, CREATOR_C]
  );
  assert.equal(unique[0]?.campaignLineId, LINE_1);
  assert.equal(unique[0]?.campaignInfluencerId, CI_A1);
});

test("apply master to a missing assignment creates inherited", () => {
  assert.equal(decideApplyMasterOutcome(null), "create_inherited");
});

test("reapplying master to inherited is idempotent", () => {
  assert.equal(decideApplyMasterOutcome({ mode: "inherited" }), "already_inherited");
});

test("reapplying master does not overwrite customized", () => {
  assert.equal(decideApplyMasterOutcome({ mode: "customized" }), "kept_customized");
});

test("concurrent unique-violation is classified from the winning row", () => {
  assert.equal(classifyApplyInsertConflict({ mode: "inherited" }), "already_inherited");
  assert.equal(classifyApplyInsertConflict({ mode: "customized" }), "kept_customized");
  assert.equal(classifyApplyInsertConflict(null), "retry");
});

test("inherited assignment follows the current master revision", () => {
  const assignment = assignmentRecord({
    id: "asg-a",
    campaign_header_id: HEADER,
    script_id: SCRIPT,
    campaign_line_id: LINE_1,
    influencer_id: CREATOR_A,
    campaign_influencer_id: CI_A1,
    mode: "inherited",
    override_revision_id: null,
    forked_from_master_revision_id: null,
    assigned_at: iso(),
    assigned_by: null,
    updated_at: iso(),
    translation_status: "idle",
    translation_target_language: null,
    translation_source_revision_id: null,
    translation_error: null,
    translation_attempts: 0,
    translation_updated_at: null,
  });
  const before = resolveEffectiveScript({ assignment, masterRevisionId: MASTER_REV });
  const after = resolveEffectiveScript({ assignment, masterRevisionId: MASTER_REV_2 });
  assert.equal(before.kind, "inherited");
  assert.equal(after.kind, "inherited");
  if (before.kind === "inherited" && after.kind === "inherited") {
    assert.equal(before.revisionId, MASTER_REV);
    assert.equal(after.revisionId, MASTER_REV_2);
    assert.equal(after.alignment, "current");
  }
});

test("customized assignment stays on the override after a master update", () => {
  const assignment = assignmentRecord({
    id: "asg-c",
    campaign_header_id: HEADER,
    script_id: SCRIPT,
    campaign_line_id: LINE_2,
    influencer_id: CREATOR_C,
    campaign_influencer_id: CI_C2,
    mode: "customized",
    override_revision_id: "rev-override-1",
    forked_from_master_revision_id: MASTER_REV,
    assigned_at: iso(),
    assigned_by: null,
    updated_at: iso(),
    translation_status: "idle",
    translation_target_language: null,
    translation_source_revision_id: null,
    translation_error: null,
    translation_attempts: 0,
    translation_updated_at: null,
  });
  const after = resolveEffectiveScript({ assignment, masterRevisionId: MASTER_REV_2 });
  assert.equal(after.kind, "customized");
  if (after.kind === "customized") {
    assert.equal(after.revisionId, "rev-override-1");
    assert.equal(after.alignment, "master_updated");
  }
  assert.equal(
    scriptAssignmentAlignment({
      mode: "customized",
      forkedFromMasterRevisionId: MASTER_REV,
      masterRevisionId: MASTER_REV,
    }),
    "customized"
  );
});

test("returning a customized creator to master requires confirmation", () => {
  assert.equal(decideReapplyMaster({ mode: "customized", confirmed: false }), "requires_confirmation");
  assert.equal(decideReapplyMaster({ mode: "customized", confirmed: true }), "reapply");
  assert.equal(decideReapplyMaster({ mode: "inherited", confirmed: true }), "already_inherited");
  assert.equal(decideCustomizeAssignment({ mode: "inherited" }), "fork");
  assert.equal(decideCustomizeAssignment({ mode: "customized" }), "already_customized");
});

test("RLS denies client content-token and unauthorized internal access", () => {
  assert.equal(
    canAccessCampaignScriptAssignment({
      operation: "select",
      hasCampaignsRead: true,
      hasCampaignsWrite: true,
      canAccessCampaignHeader: true,
      isClientContentToken: true,
    }),
    false
  );
  assert.equal(
    canAccessCampaignScriptAssignment({
      operation: "select",
      hasCampaignsRead: false,
      hasCampaignsWrite: false,
      canAccessCampaignHeader: true,
    }),
    false
  );
  assert.equal(
    canAccessCampaignScriptAssignment({
      operation: "insert",
      hasCampaignsRead: true,
      hasCampaignsWrite: false,
      canAccessCampaignHeader: true,
    }),
    false
  );
  assert.equal(
    canAccessCampaignScriptAssignment({
      operation: "select",
      hasCampaignsRead: true,
      hasCampaignsWrite: false,
      canAccessCampaignHeader: false,
    }),
    false
  );
  assert.equal(
    canAccessCampaignScriptAssignment({
      operation: "insert",
      hasCampaignsRead: true,
      hasCampaignsWrite: true,
      canAccessCampaignHeader: true,
    }),
    true
  );
});

test("assignment migration SQL enforces unique creator/script and internal RLS", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/20260829010000_campaign_script_assignments.sql"),
    "utf8"
  );
  assert.match(sql, /UNIQUE \(script_id, influencer_id\)/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /has_permission\('campaigns.read'\)/);
  assert.match(sql, /has_permission\('campaigns.write'\)/);
  assert.match(sql, /can_access_campaign_header\(campaign_header_id\)/);
  assert.match(sql, /REVOKE ALL ON public.campaign_script_assignments FROM PUBLIC, anon/);
});

test("lists campaign_influencers on selected lines in line-selection order", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const rows = await listCampaignScriptParticipationsForLines(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_2, LINE_1],
  });
  assert.deepEqual(
    rows.map((row) => row.influencerId),
    [CREATOR_A, CREATOR_C, CREATOR_B]
  );
  assert.equal(rows[0]?.campaignLineId, LINE_2);
});

test("apply master to one creator creates a single inherited assignment", async () => {
  const db = createMemoryDb();
  db.influencers = [packageInfluencers()[0]!];
  const result = await applyMasterScriptToLineIds(createMemorySupabase(db), {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
    actorUserId: "user-1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.influencerId, CREATOR_A);
  assert.equal(result.items[0]?.outcome, "created");
  assert.equal(result.items[0]?.campaignLineId, LINE_1);
  assert.equal(result.items[0]?.campaignInfluencerId, CI_A1);
  assert.equal(db.assignments.length, 1);
  assert.equal(db.assignments[0]?.mode, "inherited");
  assert.equal(db.assignments[0]?.override_revision_id, null);
});

test("apply master to multiple creators on one line", async () => {
  const db = createMemoryDb();
  const result = await applyMasterScriptToLineIds(createMemorySupabase(db), {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.items.map((item) => item.influencerId).sort(),
    [CREATOR_A, CREATOR_B]
  );
  assert.ok(result.items.every((item) => item.outcome === "created"));
});

test("apply master to selected lines expands package members and dedupes Creator A", async () => {
  const db = createMemoryDb();
  const result = await applyMasterScriptToLineIds(createMemorySupabase(db), {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1, LINE_2],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.items.map((item) => item.influencerId),
    [CREATOR_A, CREATOR_B, CREATOR_C]
  );
  assert.equal(db.assignments.length, 3);
  const creatorA = db.assignments.find((row) => row.influencer_id === CREATOR_A);
  assert.equal(creatorA?.campaign_line_id, LINE_1);
  assert.equal(creatorA?.campaign_influencer_id, CI_A1);
});

test("reapplying master to inherited creators does not insert duplicates", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const first = await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1, LINE_2],
  });
  const second = await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1, LINE_2],
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(db.assignments.length, 3);
  assert.ok(second.items.every((item) => item.outcome === "already_inherited"));
});

test("apply master leaves a customized creator on their override", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const created = await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1, LINE_2],
  });
  assert.equal(created.ok, true);
  const customized = await customizeCampaignScriptAssignment(supabase, {
    assignmentId: `asg-${CREATOR_B}`,
    actorLabel: "Mona",
  });
  assert.equal(customized.ok, true);
  if (customized.ok) {
    assert.equal(customized.assignment.mode, "customized");
    assert.ok(customized.assignment.overrideRevisionId);
    assert.equal(customized.assignment.forkedFromMasterRevisionId, MASTER_REV);
  }

  const reapplied = await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
  });
  assert.equal(reapplied.ok, true);
  if (!reapplied.ok) return;
  const creatorB = reapplied.items.find((item) => item.influencerId === CREATOR_B);
  assert.equal(creatorB?.outcome, "kept_customized");
  assert.equal(db.assignments.find((row) => row.influencer_id === CREATOR_B)?.mode, "customized");
  assert.equal(
    db.revisions.filter((row) => row.assignment_id === `asg-${CREATOR_B}`).length,
    1
  );
  assert.equal(db.script.current_revision_id, MASTER_REV);
});

test("customized creator can be explicitly returned to master", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
  });
  await customizeCampaignScriptAssignment(supabase, { assignmentId: `asg-${CREATOR_A}` });

  const denied = await reapplyMasterToCampaignScriptAssignment(supabase, {
    assignmentId: `asg-${CREATOR_A}`,
    confirmed: false,
  });
  assert.equal(denied.ok, false);

  const reapplied = await reapplyMasterToCampaignScriptAssignment(supabase, {
    assignmentId: `asg-${CREATOR_A}`,
    confirmed: true,
  });
  assert.equal(reapplied.ok, true);
  if (!reapplied.ok) return;
  assert.equal(reapplied.assignment.mode, "inherited");
  assert.equal(reapplied.assignment.overrideRevisionId, null);
  assert.equal(
    db.revisions.some((row) => row.assignment_id === `asg-${CREATOR_A}`),
    true
  );
});

test("concurrent apply to the same creator does not create duplicates", async () => {
  const db = createMemoryDb();
  db.influencers = [packageInfluencers()[0]!];
  const supabase = createMemorySupabase(db);
  const [first, second] = await Promise.all([
    applyMasterScriptToLineIds(supabase, { campaignHeaderId: HEADER, lineIds: [LINE_1] }),
    applyMasterScriptToLineIds(supabase, { campaignHeaderId: HEADER, lineIds: [LINE_1] }),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(db.assignments.length, 1);
  if (first.ok && second.ok) {
    const outcomes = [first.items[0]?.outcome, second.items[0]?.outcome].sort();
    assert.deepEqual(outcomes, ["already_inherited", "created"]);
  }
});

test("assignment stores campaign, creator, and participation references", async () => {
  const db = createMemoryDb();
  const result = await applyMasterScriptToLineIds(createMemorySupabase(db), {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
  });
  assert.equal(result.ok, true);
  const row = db.assignments[0];
  assert.ok(row);
  assert.equal(row.campaign_header_id, HEADER);
  assert.equal(row.script_id, SCRIPT);
  assert.equal(row.campaign_line_id, LINE_1);
  assert.equal(row.influencer_id, CREATOR_A);
  assert.equal(row.campaign_influencer_id, CI_A1);
});

test("preview counts unique creators and protects customized rows", () => {
  const preview = previewApplyMasterScript({
    masterVersion: "v1.1",
    masterRevisionId: MASTER_REV,
    participations: expandLineParticipationsToCreators([
      { campaignInfluencerId: CI_A1, campaignLineId: LINE_1, influencerId: CREATOR_A },
      { campaignInfluencerId: CI_B1, campaignLineId: LINE_1, influencerId: CREATOR_B },
      { campaignInfluencerId: CI_A2, campaignLineId: LINE_2, influencerId: CREATOR_A },
      { campaignInfluencerId: CI_C2, campaignLineId: LINE_2, influencerId: CREATOR_C },
    ]),
    existingByInfluencerId: new Map([
      [CREATOR_A, { mode: "inherited" }],
      [CREATOR_B, { mode: "customized" }],
    ]),
  });
  assert.equal(preview.creatorCount, 3);
  assert.equal(preview.willCreate, 1);
  assert.equal(preview.alreadyInherited, 1);
  assert.equal(preview.keptCustomized, 1);
});

test("status labels distinguish inherited current from customized based-on", () => {
  const inherited = creatorScriptStatusView({
    influencerId: CREATOR_A,
    assignment: { id: "asg-a", mode: "inherited", forkedFromMasterRevisionId: null },
    masterVersion: "v1.2",
    forkedFromVersion: null,
    masterRevisionId: MASTER_REV_2,
  });
  const customized = creatorScriptStatusView({
    influencerId: CREATOR_B,
    assignment: { id: "asg-b", mode: "customized", forkedFromMasterRevisionId: MASTER_REV },
    masterVersion: "v1.2",
    forkedFromVersion: "v1.0",
    masterRevisionId: MASTER_REV_2,
  });
  assert.equal(inherited?.versionLabel, "Current v1.2");
  assert.equal(inherited?.actionLabel, "Open");
  assert.equal(customized?.versionLabel, "Based on v1.0");
  assert.match(customized?.alignmentNote ?? "", /updated since this creator was customized/);
});

test("saving a customized override does not move the master pointer", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
  });
  const customized = await customizeCampaignScriptAssignment(supabase, {
    assignmentId: `asg-${CREATOR_A}`,
  });
  assert.equal(customized.ok, true);
  if (!customized.ok) return;
  const masterBefore = db.script.current_revision_id;
  const saved = await saveCampaignScriptOverride(supabase, customized.assignment, {
    expectedCurrentRevisionId: customized.assignment.overrideRevisionId,
    sourceLanguage: "en",
    bodyEn: "Create a 45-second Instagram Reel.",
    bodyAr: "",
    actorKind: "internal",
    actorUserId: null,
    actorLabel: "Mona",
  });
  assert.equal(saved.ok, true);
  assert.equal(db.script.current_revision_id, masterBefore);
  assert.equal(db.script.current_revision_id, MASTER_REV);
  if (saved.ok) {
    assert.equal(saved.script.bodyEn, "Create a 45-second Instagram Reel.");
  }
});

test("override translation jobs do not collide with master job ids", () => {
  assert.notEqual(
    campaignScriptTranslateJobId(SCRIPT, MASTER_REV, "ar"),
    campaignScriptTranslateJobId(SCRIPT, MASTER_REV, "ar", "asg-a")
  );
});

test("client workspace campaign script actions do not load creator assignments", () => {
  const src = readFileSync(
    resolve("features/client-workspace/actions/campaign-script-actions.ts"),
    "utf8"
  );
  assert.equal(src.includes("campaign_script_assignments"), false);
  assert.equal(src.includes("loadCreatorCampaignScript"), false);
  assert.equal(src.includes("saveCampaignScriptOverride"), false);
});

test("applying master does not copy script bodies for inherited creators", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  const revisionCount = db.revisions.length;
  const result = await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
  });
  assert.equal(result.ok, true);
  assert.equal(db.revisions.length, revisionCount);
  assert.equal(db.assignments[0]?.mode, "inherited");
  assert.equal(db.assignments[0]?.override_revision_id, null);
});

test("inherited creator reads live master; customized override stays after master update", async () => {
  const db = createMemoryDb();
  const supabase = createMemorySupabase(db);
  await applyMasterScriptToLineIds(supabase, {
    campaignHeaderId: HEADER,
    lineIds: [LINE_1],
  });

  const inheritedA = await loadCreatorCampaignScript(supabase, {
    campaignHeaderId: HEADER,
    influencerId: CREATOR_A,
  });
  assert.equal(inheritedA.assignment?.mode, "inherited");
  assert.equal(inheritedA.readOnly, true);
  assert.equal(inheritedA.effective?.currentRevisionId, MASTER_REV);
  assert.equal(inheritedA.effective?.bodyEn, inheritedA.master?.bodyEn);

  const customized = await customizeCampaignScriptAssignment(supabase, {
    assignmentId: `asg-${CREATOR_A}`,
  });
  assert.equal(customized.ok, true);
  if (!customized.ok) return;
  assert.ok(customized.assignment.overrideRevisionId);
  assert.notEqual(customized.assignment.overrideRevisionId, MASTER_REV);

  db.revisions.push(masterRevision(MASTER_REV_2, 2, "Create a 45-second Instagram Reel."));
  db.script.current_revision_id = MASTER_REV_2;

  const afterMasterUpdateA = await loadCreatorCampaignScript(supabase, {
    campaignHeaderId: HEADER,
    influencerId: CREATOR_A,
  });
  assert.equal(afterMasterUpdateA.assignment?.mode, "customized");
  assert.equal(afterMasterUpdateA.effective?.currentRevisionId, customized.assignment.overrideRevisionId);
  assert.equal(afterMasterUpdateA.effective?.bodyEn, "Create a 30-second Instagram Reel.");
  assert.match(afterMasterUpdateA.status?.alignmentNote ?? "", /updated since this creator was customized/);

  const afterMasterUpdateB = await loadCreatorCampaignScript(supabase, {
    campaignHeaderId: HEADER,
    influencerId: CREATOR_B,
  });
  assert.equal(afterMasterUpdateB.assignment?.mode, "inherited");
  assert.equal(afterMasterUpdateB.effective?.currentRevisionId, MASTER_REV_2);
  assert.equal(afterMasterUpdateB.effective?.bodyEn, "Create a 45-second Instagram Reel.");
});

test("saving a customized override does not queue translation", () => {
  assert.deepEqual(shouldQueueTranslationAfterSave(), { queue: false });
});

test("bulk apply classifies per-line outcomes without a second runner", () => {
  assert.deepEqual(classifyApplyCampaignScriptLineItems([]), {
    skipped: true,
    message: "No creators on this assignment.",
  });
  assert.deepEqual(
    classifyApplyCampaignScriptLineItems([{ outcome: "kept_customized" }]),
    { skipped: true, message: "Customized script kept unchanged." }
  );
  assert.deepEqual(
    classifyApplyCampaignScriptLineItems([{ outcome: "already_inherited" }]),
    { skipped: true, message: "Already inherits the campaign script." }
  );
  assert.deepEqual(
    classifyApplyCampaignScriptLineItems([{ outcome: "created" }, { outcome: "already_inherited" }]),
    { skipped: false }
  );
});

test("internal assignment UI no longer exposes campaign-level script apply", () => {
  const bar = readFileSync(
    resolve("features/campaigns/components/assignment-hierarchy/floating-selection-bar.tsx"),
    "utf8"
  );
  assert.equal(bar.includes("Apply Campaign Script"), false);
  assert.equal(bar.includes("mutateApplyCampaignScriptToLine"), false);
  assert.equal(bar.includes("ApplyCampaignScriptDialog"), false);

  const grid = readFileSync(
    resolve("features/campaigns/components/assignment-hierarchy/assignment-safe-grid.tsx"),
    "utf8"
  );
  assert.equal(grid.includes("AssignmentScriptStatusPill"), false);
  assert.equal(grid.includes("listCampaignScriptAssignmentStatusesAction"), false);

  const clientSection = readFileSync(
    resolve("features/client-workspace/components/campaign-script-section.tsx"),
    "utf8"
  );
  assert.equal(clientSection.includes("CreatorScriptSheet"), false);
  assert.equal(clientSection.includes("campaign_script_assignments"), false);

  const workspaceTabs = readFileSync(
    resolve("features/campaigns/components/campaign-workspace.tsx"),
    "utf8"
  );
  assert.equal(/label:\s*"Scripts"/.test(workspaceTabs), false);
  assert.match(workspaceTabs, /label: "Assignments"/);
  assert.match(workspaceTabs, /label: "Deliverables"/);
});

