"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  AlertCircleIcon,
  BarChart3Icon,
  CheckSquareIcon,
  CircleDollarSignIcon,
  ClockIcon,
  FileTextIcon,
  InfoIcon,
  PackageIcon,
  ShieldIcon,
  TargetIcon,
  TypeIcon,
} from "lucide-react";

import {
  getCampaignIntelligenceExtras,
  hasCampaignIntelligenceExtras,
} from "../services/discovery-campaign-requirements";
import { getValidatedIntelligence } from "../services/get-validated-intelligence";
import {
  buildEvidenceReviewRows,
  type EvidenceLevel,
} from "../services/normalization";
import type { FieldProvenance } from "../services/normalization/types";
import type { CampaignIntelligenceProfile } from "../types/profile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: CampaignIntelligenceProfile;
};

const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  extracted: "Extracted",
  normalized: "Normalized",
  inferred: "Inferred",
};

function EvidencePill({ provenance }: { provenance?: FieldProvenance }) {
  if (!provenance) {
    return (
      <span className="thinkway-campaign-intel-pill thinkway-campaign-intel-pill-muted">
        Unverified
      </span>
    );
  }

  const pillClass =
    provenance.level === "extracted"
      ? "thinkway-campaign-intel-pill-extracted"
      : provenance.level === "normalized"
        ? "thinkway-campaign-intel-pill-normalized"
        : "thinkway-campaign-intel-pill-inferred";

  return (
    <span className={`thinkway-campaign-intel-pill ${pillClass}`}>
      {EVIDENCE_LABELS[provenance.level]} {Math.round(provenance.confidence * 100)}%
    </span>
  );
}

function EvidenceCard({
  label,
  value,
  provenance,
}: {
  label: string;
  value: string;
  provenance?: FieldProvenance;
}) {
  const confidence = provenance?.confidence ?? 0;

  return (
    <div className="thinkway-campaign-intel-evidence-card">
      <div className="thinkway-campaign-intel-evidence-top">
        <span className="thinkway-campaign-intel-evidence-label">{label}</span>
        <EvidencePill provenance={provenance} />
      </div>
      <div className="thinkway-campaign-intel-evidence-value">{value}</div>
      {confidence > 0 ? (
        <div className="thinkway-campaign-intel-conf-bar">
          <div
            className="thinkway-campaign-intel-conf-fill"
            style={{ width: `${Math.round(confidence * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function IntelRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="thinkway-campaign-intel-row">
      <div className="thinkway-campaign-intel-row-ico">{icon}</div>
      <div className="thinkway-campaign-intel-row-body">
        <div className="thinkway-campaign-intel-row-label">{label}</div>
        {children}
      </div>
    </div>
  );
}

function TagRow({ values }: { values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="thinkway-campaign-intel-tag-row">
      {values.map((value) => (
        <span key={value} className="thinkway-campaign-intel-tag">
          {value}
        </span>
      ))}
    </div>
  );
}

export function CampaignIntelligenceDetailSheet({ open, onOpenChange, profile }: Props) {
  const extras = getCampaignIntelligenceExtras(profile);
  const validated = getValidatedIntelligence(profile);
  const evidenceRows = buildEvidenceReviewRows(validated ?? undefined);

  const commercialRows: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    content: ReactNode;
  }> = [];

  if (extras.campaignName) {
    commercialRows.push({
      key: "campaign",
      label: "Campaign",
      icon: <FileTextIcon />,
      content: <div className="thinkway-campaign-intel-row-value">{extras.campaignName}</div>,
    });
  }

  if (extras.campaignType) {
    commercialRows.push({
      key: "type",
      label: "Type",
      icon: <TypeIcon />,
      content: <div className="thinkway-campaign-intel-row-value">{extras.campaignType}</div>,
    });
  }

  if (extras.objectives.length) {
    commercialRows.push({
      key: "objectives",
      label: "Objectives",
      icon: <TargetIcon />,
      content: (
        <div className="thinkway-campaign-intel-row-value">{extras.objectives.join(" ")}</div>
      ),
    });
  }

  if (extras.deliverables.length) {
    commercialRows.push({
      key: "deliverables",
      label: "Deliverables",
      icon: <CheckSquareIcon />,
      content: <TagRow values={extras.deliverables} />,
    });
  }

  if (extras.kpis.length) {
    commercialRows.push({
      key: "kpis",
      label: "KPIs",
      icon: <BarChart3Icon />,
      content: <TagRow values={extras.kpis} />,
    });
  }

  if (extras.budget?.amount) {
    commercialRows.push({
      key: "budget",
      label: "Budget",
      icon: <CircleDollarSignIcon />,
      content: (
        <div className="thinkway-campaign-intel-row-value">
          {extras.budget.amount.toLocaleString()} {extras.budget.currency}
        </div>
      ),
    });
  }

  if (extras.durationWeeks) {
    commercialRows.push({
      key: "duration",
      label: "Duration",
      icon: <ClockIcon />,
      content: (
        <div className="thinkway-campaign-intel-row-value">{extras.durationWeeks} weeks</div>
      ),
    });
  }

  if (extras.products.length) {
    commercialRows.push({
      key: "products",
      label: "Products",
      icon: <PackageIcon />,
      content: <TagRow values={extras.products} />,
    });
  }

  if (extras.constraints.length) {
    commercialRows.push({
      key: "constraints",
      label: "Constraints",
      icon: <AlertCircleIcon />,
      content: <TagRow values={extras.constraints} />,
    });
  }

  if (extras.risks.length) {
    commercialRows.push({
      key: "risks",
      label: "Risks",
      icon: <AlertCircleIcon />,
      content: <TagRow values={extras.risks} />,
    });
  }

  if (extras.toneOfVoice.length) {
    commercialRows.push({
      key: "tone",
      label: "Tone of voice",
      icon: <TypeIcon />,
      content: <TagRow values={extras.toneOfVoice} />,
    });
  }

  if (extras.marketTier) {
    commercialRows.push({
      key: "market-tier",
      label: "Market tier",
      icon: <TargetIcon />,
      content: <div className="thinkway-campaign-intel-row-value">{extras.marketTier}</div>,
    });
  }

  if (extras.brandSafetyLevel) {
    commercialRows.push({
      key: "brand-safety",
      label: "Brand safety",
      icon: <ShieldIcon />,
      content: <div className="thinkway-campaign-intel-row-value">{extras.brandSafetyLevel}</div>,
    });
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const emptyState =
    !hasCampaignIntelligenceExtras(profile) && evidenceRows.length === 0 && commercialRows.length === 0;

  return (
    <aside
      className="thinkway-campaign-intel-sidebar fixed inset-y-0 right-0 z-[60] flex h-full w-full max-w-[min(480px,42vw)] flex-col overflow-hidden border-l border-[var(--camp-border)] shadow-[-16px_0_48px_rgba(13,21,38,0.18)] animate-in slide-in-from-right duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-intel-title"
    >
        <div className="thinkway-campaign-intel-head">
          <div className="thinkway-campaign-intel-head-left">
            <div className="thinkway-campaign-intel-head-ico">
              <FileTextIcon strokeWidth={2} />
            </div>
            <div>
              <h2 id="campaign-intel-title" className="thinkway-campaign-intel-title">
                Campaign intelligence
              </h2>
              <p className="thinkway-campaign-intel-sub">
                Commercial brief extraction for strategy and operations. Discovery search uses only
                verified requirements with extracted or normalized evidence.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="thinkway-campaign-req-close"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="thinkway-campaign-intel-scroll">
          <div className="thinkway-campaign-intel-legend">
            <InfoIcon strokeWidth={2} />
            <p>
              <b>Extracted</b> = stated in brief · <b>Normalized</b> = canonically mapped ·{" "}
              <b>Inferred</b> = not saved to Discovery
            </p>
          </div>

          {evidenceRows.length > 0 ? (
            <div className="thinkway-campaign-intel-section">
              <div className="thinkway-campaign-intel-section-title">Field evidence review</div>
              <div className="thinkway-campaign-intel-evidence-grid">
                {evidenceRows.map((row) => (
                  <EvidenceCard
                    key={row.key}
                    label={row.label}
                    value={row.value}
                    provenance={row.provenance}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {commercialRows.length > 0 ? (
            <div className="thinkway-campaign-intel-section">
              <div className="thinkway-campaign-intel-section-title">Commercial intelligence</div>
              <div className="thinkway-campaign-intel-card">
                {commercialRows.map((row) => (
                  <IntelRow key={row.key} icon={row.icon} label={row.label}>
                    {row.content}
                  </IntelRow>
                ))}
              </div>
            </div>
          ) : null}

          {extras.extractionIssues.length > 0 ? (
            <div className="thinkway-campaign-intel-issues">
              <p className="thinkway-campaign-intel-issues-title">Extraction issues</p>
              <ul className="thinkway-campaign-intel-issues-list">
                {extras.extractionIssues.map((issue, index) => (
                  <li key={`${issue.field}-${index}`}>
                    <strong>{issue.field}:</strong> &ldquo;{issue.rawValue}&rdquo; — {issue.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {emptyState ? (
            <p className="py-12 text-center text-sm text-[var(--camp-text-3)]">
              No campaign intelligence fields were extracted.
            </p>
          ) : null}
        </div>

        <div className="thinkway-campaign-intel-foot">
          <button
            type="button"
            className="thinkway-campaign-req-btn"
            onClick={() => onOpenChange(false)}
          >
            Close
          </button>
          <button
            type="button"
            className="thinkway-campaign-req-btn thinkway-campaign-req-btn-primary"
            onClick={() => onOpenChange(false)}
          >
            Edit intelligence
          </button>
        </div>
      </aside>
  );
}

export { hasCampaignIntelligenceExtras };
