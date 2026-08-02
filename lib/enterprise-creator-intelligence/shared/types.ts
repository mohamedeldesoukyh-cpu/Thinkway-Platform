/**
 * Shared Enterprise Creator Intelligence primitives.
 * Evidence Coverage ≠ Confidence.
 */

export type EvidenceCoverage = {
  /** 0–100: completeness of available information (not model trust). */
  percent: number | null;
  reason: string;
  basedOn: Array<{ label: string; value: string | number }>;
  missingInputs: string[];
};

export type EvidenceBasedOn = EvidenceCoverage["basedOn"];
