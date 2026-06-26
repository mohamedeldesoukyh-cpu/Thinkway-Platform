import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

import {
  CREATOR_IMPORT_STATUSES,
  type CreatorImportStatus,
} from "@/features/discovery-import/types";

const STATUS_LABELS: Record<CreatorImportStatus, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

type ImportStatusBadgeProps = {
  status: string;
  className?: string;
};

export function ImportStatusBadge({ status, className }: ImportStatusBadgeProps) {
  const key = (CREATOR_IMPORT_STATUSES.includes(status as CreatorImportStatus)
    ? status
    : "uploaded") as CreatorImportStatus;
  const tone = resolveStatusTone("import", key);

  return (
    <StatusBadge
      label={STATUS_LABELS[key]}
      tone={tone}
      className={className}
    />
  );
}
