import { deliverableUploadPercent, type DeliverableUploadPhase } from '@/features/campaigns/deliverable-asset-upload';
import React from "react";

export type CardUploadProgress = {
  unitKey: string;
  fileName: string;
  phase: DeliverableUploadPhase;
  loaded: number;
  total: number;
};

export function DeliverableUploadProgress({ progress }: { progress: CardUploadProgress }) {
  const determinate = progress.phase === 'uploading' && progress.total > 0;
  const percent = deliverableUploadPercent(progress.loaded, progress.total);
  const label = progress.phase === 'preparing' ? 'Preparing upload' : progress.phase === 'finishing' ? 'Saving upload' : 'Uploading';
  return <div className="dv-upload-progress" role="status" aria-live="polite">
    <div className={`dv-upload-progress__circle${determinate ? '' : ' is-pending'}`}
      role="progressbar" aria-label={`${label}: ${progress.fileName}`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate ? percent : undefined}
      aria-valuetext={determinate ? `${percent}% uploaded` : label}>
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle className="dv-upload-progress__track" cx="24" cy="24" r="20" />
        <circle className="dv-upload-progress__value" cx="24" cy="24" r="20" pathLength="100"
          strokeDasharray={`${determinate ? percent : 25} 100`} />
      </svg>
      <span aria-hidden="true">{determinate ? `${percent}%` : '↑'}</span>
    </div>
    <div className="dv-upload-progress__text"><strong>{label}</strong><span>{progress.fileName}</span>
      {progress.phase === 'finishing' && <small>File transferred. Saving this version…</small>}
    </div>
  </div>;
}
