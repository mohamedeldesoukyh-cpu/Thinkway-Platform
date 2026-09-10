/**
 * The Content screen showed raw markdown.
 *
 * Every section without structured data falls back to its formatter's text,
 * and that text was printed verbatim — `**Duration:** 4 weeks` and
 * `**Week 1** — Campaign Start`, asterisks included. These tests run the real
 * formatter output through the parser the fallback renderer now uses.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { formatTimelineForDisplay } from "@/features/campaign-intelligence/services/section-formatters";

import {
  hasSectionMarkdown,
  parseSectionMarkdown,
  parseSectionMarkdownSpans,
} from "./section-markdown";

/** The Kérastase content/timeline output, from the real formatter. */
const TIMELINE = formatTimelineForDisplay({
  durationWeeks: 4,
  goLiveWeek: 3,
  milestones: [
    { week: 1, phase: "Campaign Start", activities: ["Campaign kickoff", "Creator briefing aligned to strategy"] },
    { week: 2, phase: "Content Production", activities: ["Mega/Macro tier content", "Brand review cycles"] },
    { week: 4, phase: "Reporting", activities: ["Performance analysis"] },
  ],
});

test("the real formatter output is markdown, which the plain renderer leaked", () => {
  assert.match(TIMELINE, /\*\*Duration:\*\* 4 weeks/);
  assert.equal(hasSectionMarkdown(TIMELINE), true);
});

test("no asterisk survives parsing — the operator never sees a marker", () => {
  const blocks = parseSectionMarkdown(TIMELINE);
  const rendered = blocks
    .flatMap((block) => block.lines)
    .flatMap((line) => line.spans)
    .map((span) => span.text)
    .join("");

  assert.ok(!rendered.includes("**"), `bold markers leaked: ${rendered}`);
  assert.ok(rendered.includes("Duration:"), "the label itself is kept");
  assert.ok(rendered.includes("4 weeks"));
});

test("a bold label becomes a bold span with its value beside it", () => {
  const spans = parseSectionMarkdownSpans("**Duration:** 4 weeks");
  assert.deepEqual(spans, [
    { text: "Duration:", bold: true },
    { text: " 4 weeks" },
  ]);
});

test("a week heading keeps its em dash and phase", () => {
  const spans = parseSectionMarkdownSpans("**Week 1** — Campaign Start");
  assert.deepEqual(spans, [
    { text: "Week 1", bold: true },
    { text: " — Campaign Start" },
  ]);
});

test("activity lines are read as bullets, keeping their indent", () => {
  const blocks = parseSectionMarkdown(TIMELINE);
  const bullets = blocks
    .flatMap((block) => block.lines)
    .filter((line) => line.kind === "bullet");

  assert.ok(bullets.length >= 5, `expected the activities as bullets, got ${bullets.length}`);
  assert.ok(
    bullets.every((line) => line.spans.map((s) => s.text).join("").trim().length > 0)
  );
});

test("emphasis and headings are parsed, not printed", () => {
  const blocks = parseSectionMarkdown("## Primary KPIs\n_forecast is directional_");
  assert.equal(blocks[0]!.lines[0]!.kind, "heading");
  assert.ok(blocks[0]!.lines[0]!.kind === "heading");
  assert.equal(blocks[0]!.lines[0]!.level, 2);
  assert.deepEqual(blocks[0]!.lines[1]!.spans, [{ text: "forecast is directional", italic: true }]);
});

test("blank lines still separate paragraphs, so spacing is unchanged", () => {
  const blocks = parseSectionMarkdown("First line\n\nSecond block\nThird line");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.lines.length, 1);
  assert.equal(blocks[1]!.lines.length, 2);
});

test("plain text with no markdown is returned untouched", () => {
  const blocks = parseSectionMarkdown("Per-creator content plan appears after Strategy.");
  assert.deepEqual(blocks[0]!.lines[0]!.spans, [
    { text: "Per-creator content plan appears after Strategy." },
  ]);
  assert.equal(hasSectionMarkdown("Per-creator content plan appears after Strategy."), false);
});
