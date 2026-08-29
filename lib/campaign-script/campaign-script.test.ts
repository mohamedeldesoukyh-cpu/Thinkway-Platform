import assert from "node:assert/strict";
import { test } from "node:test";

import { applyExtractedText, detectScriptLanguage, mergeExtractedScriptText } from "./language";
import {
  decideCasWrite,
  formatScriptCurrentLabel,
  nextBusinessVersion,
  nextRevisionNumber,
  resolveScriptOrigins,
  scriptOriginBadge,
  validateScriptBodies,
  businessVersionForSave,
} from "./policy";

test("detects Arabic as the source language", () => {
  const detected = detectScriptLanguage("هذا هو السكربت الكامل للحملة مع تفاصيل التصوير");
  assert.equal(detected.language, "ar");
  assert.equal(detected.mixed, false);
  assert.equal(detected.confidence, "high");
});

test("detects English as the source language", () => {
  const detected = detectScriptLanguage("This is the full campaign script with shoot details.");
  assert.equal(detected.language, "en");
  assert.equal(detected.mixed, false);
});

test("flags mixed English and Arabic so the user must confirm the source", () => {
  const detected = detectScriptLanguage(
    "This campaign script is for the summer shoot and هذا النص العربي يوضح المشهد بالكامل مع التفاصيل"
  );
  assert.equal(detected.mixed, true);
  assert.equal(detected.confidence, "low");
});

test("places extracted text into the source language body only", () => {
  assert.deepEqual(applyExtractedText("Hello", "en"), { bodyEn: "Hello", bodyAr: "" });
  assert.deepEqual(applyExtractedText("مرحبا", "ar"), { bodyEn: "", bodyAr: "مرحبا" });
});

const EXISTING_EN = "English script A";
const EXISTING_AR = "Human Arabic translation A";
const UPLOAD_EN = "English script B";
const UPLOAD_AR = "Arabic script B";
const MIXED_UPLOAD =
  "This campaign script is for the summer shoot and هذا النص العربي يوضح المشهد بالكامل مع التفاصيل";

test("existing EN + existing AR → upload EN → AR preserved", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_EN,
    sourceLanguage: "en",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  assert.deepEqual(merged, { bodyEn: UPLOAD_EN, bodyAr: EXISTING_AR });
});

test("existing EN + human-edited AR → upload EN → human-edited AR preserved", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_EN,
    sourceLanguage: "en",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  const origins = resolveScriptOrigins({
    sourceLanguage: "en",
    bodyEn: merged.bodyEn,
    bodyAr: merged.bodyAr,
    previous: {
      sourceLanguage: "en",
      bodyEn: EXISTING_EN,
      bodyAr: EXISTING_AR,
      enOrigin: "source",
      arOrigin: "human_edited",
    },
  });
  assert.equal(merged.bodyAr, EXISTING_AR);
  assert.equal(origins.arOrigin, "human_edited");
  assert.equal(origins.enOrigin, "source");
});

test("existing EN + existing AR → upload AR → EN preserved", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_AR,
    sourceLanguage: "ar",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  assert.deepEqual(merged, { bodyEn: EXISTING_EN, bodyAr: UPLOAD_AR });
});

test("existing human-edited EN + upload AR → EN preserved", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_AR,
    sourceLanguage: "ar",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  const origins = resolveScriptOrigins({
    sourceLanguage: "ar",
    bodyEn: merged.bodyEn,
    bodyAr: merged.bodyAr,
    previous: {
      sourceLanguage: "en",
      bodyEn: EXISTING_EN,
      bodyAr: EXISTING_AR,
      enOrigin: "human_edited",
      arOrigin: "source",
    },
  });
  assert.equal(merged.bodyEn, EXISTING_EN);
  assert.equal(origins.enOrigin, "human_edited");
  assert.equal(origins.arOrigin, "source");
});

test("empty campaign + upload EN → EN populated, AR remains empty/pending", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_EN,
    sourceLanguage: "en",
    existingBodyEn: "",
    existingBodyAr: "",
  });
  const origins = resolveScriptOrigins({
    sourceLanguage: "en",
    bodyEn: merged.bodyEn,
    bodyAr: merged.bodyAr,
  });
  assert.deepEqual(merged, { bodyEn: UPLOAD_EN, bodyAr: "" });
  assert.equal(origins.enOrigin, "source");
  assert.equal(origins.arOrigin, "generated");
  assert.equal(
    scriptOriginBadge({
      language: "ar",
      sourceLanguage: "en",
      origin: origins.arOrigin,
      body: merged.bodyAr,
    }),
    "Translation (Arabic) · pending"
  );
});

test("empty campaign + upload AR → AR populated, EN remains empty/pending", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_AR,
    sourceLanguage: "ar",
    existingBodyEn: "",
    existingBodyAr: "",
  });
  assert.deepEqual(merged, { bodyEn: "", bodyAr: UPLOAD_AR });
});

test("mixed upload + confirm EN → AR preserved if it already exists", () => {
  assert.equal(detectScriptLanguage(MIXED_UPLOAD).mixed, true);
  const merged = mergeExtractedScriptText({
    extractedText: MIXED_UPLOAD,
    sourceLanguage: "en",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  assert.equal(merged.bodyEn, MIXED_UPLOAD);
  assert.equal(merged.bodyAr, EXISTING_AR);
});

test("mixed upload + confirm AR → EN preserved if it already exists", () => {
  const merged = mergeExtractedScriptText({
    extractedText: MIXED_UPLOAD,
    sourceLanguage: "ar",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  assert.equal(merged.bodyAr, MIXED_UPLOAD);
  assert.equal(merged.bodyEn, EXISTING_EN);
});

test("upload must not silently overwrite either language", () => {
  const enUpload = mergeExtractedScriptText({
    extractedText: UPLOAD_EN,
    sourceLanguage: "en",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  const arUpload = mergeExtractedScriptText({
    extractedText: UPLOAD_AR,
    sourceLanguage: "ar",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  assert.notEqual(enUpload.bodyAr, "");
  assert.equal(enUpload.bodyAr, EXISTING_AR);
  assert.notEqual(arUpload.bodyEn, "");
  assert.equal(arUpload.bodyEn, EXISTING_EN);
});

test("revision contains the complete bilingual state after the upload", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_EN,
    sourceLanguage: "en",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
  });
  const origins = resolveScriptOrigins({
    sourceLanguage: "en",
    bodyEn: merged.bodyEn,
    bodyAr: merged.bodyAr,
    previous: {
      sourceLanguage: "en",
      bodyEn: EXISTING_EN,
      bodyAr: EXISTING_AR,
      enOrigin: "source",
      arOrigin: "human_edited",
    },
  });
  const revision = {
    body_en: merged.bodyEn,
    body_ar: merged.bodyAr,
    source_language: "en" as const,
    en_origin: origins.enOrigin,
    ar_origin: origins.arOrigin,
  };
  assert.deepEqual(revision, {
    body_en: UPLOAD_EN,
    body_ar: EXISTING_AR,
    source_language: "en",
    en_origin: "source",
    ar_origin: "human_edited",
  });
});

test("replace-both upload clears the other language only when explicitly requested", () => {
  const merged = mergeExtractedScriptText({
    extractedText: UPLOAD_EN,
    sourceLanguage: "en",
    existingBodyEn: EXISTING_EN,
    existingBodyAr: EXISTING_AR,
    replaceBothLanguages: true,
  });
  assert.deepEqual(merged, { bodyEn: UPLOAD_EN, bodyAr: "" });
});


test("CAS proceeds only when the expected current revision matches", () => {
  assert.equal(decideCasWrite(null, null), "proceed");
  assert.equal(decideCasWrite("rev-1", "rev-1"), "proceed");
  assert.equal(decideCasWrite(null, "rev-1"), "conflict");
  assert.equal(decideCasWrite("rev-1", "rev-2"), "conflict");
  assert.equal(decideCasWrite("rev-1", null), "conflict");
});

test("business versions start at v1 and then increment the minor", () => {
  assert.equal(nextBusinessVersion(null), "v1");
  assert.equal(nextBusinessVersion("v1"), "v1.1");
  assert.equal(nextBusinessVersion("v1.1"), "v1.2");
  assert.equal(nextRevisionNumber(null), 1);
  assert.equal(nextRevisionNumber(3), 4);
  assert.equal(businessVersionForSave("v1", false), "v1");
  assert.equal(businessVersionForSave("v1", true), "v1.1");
});

test("source language origin stays source; empty other side stays generated until edited", () => {
  const first = resolveScriptOrigins({
    sourceLanguage: "en",
    bodyEn: "Hello",
    bodyAr: "",
  });
  assert.deepEqual(first, { enOrigin: "source", arOrigin: "generated" });

  const humanArabic = resolveScriptOrigins({
    sourceLanguage: "en",
    bodyEn: "Hello",
    bodyAr: "مرحبا",
    previous: {
      sourceLanguage: "en",
      bodyEn: "Hello",
      bodyAr: "",
      enOrigin: "source",
      arOrigin: "generated",
    },
  });
  assert.equal(humanArabic.enOrigin, "source");
  assert.equal(humanArabic.arOrigin, "human_edited");
});

test("generated translation is not marked edited when the body did not change", () => {
  const origins = resolveScriptOrigins({
    sourceLanguage: "ar",
    bodyEn: "Hello",
    bodyAr: "مرحبا",
    previous: {
      sourceLanguage: "ar",
      bodyEn: "Hello",
      bodyAr: "مرحبا",
      enOrigin: "generated",
      arOrigin: "source",
    },
  });
  assert.equal(origins.enOrigin, "generated");
  assert.equal(origins.arOrigin, "source");
});

test("rejects an empty script and labels original vs pending translation", () => {
  const empty = validateScriptBodies("  ", "\n");
  assert.equal(empty.ok, false);
  assert.equal(
    scriptOriginBadge({
      language: "en",
      sourceLanguage: "ar",
      origin: "generated",
      body: "",
    }),
    "Translation (English) · pending"
  );
  assert.equal(
    scriptOriginBadge({
      language: "ar",
      sourceLanguage: "ar",
      origin: "source",
      body: "مرحبا",
    }),
    "Original (Arabic)"
  );
});

test("current label identifies version, actor, and time", () => {
  const label = formatScriptCurrentLabel({
    businessVersion: "v1.1",
    actorKind: "internal",
    actorLabel: "Mona",
    createdAt: "2026-08-28T18:02:00.000Z",
  });
  assert.match(label, /^Current · v1\.1 · Mona · /);
});
