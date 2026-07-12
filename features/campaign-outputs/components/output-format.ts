/** Small display formatters for the Campaign Outputs Center. */

export function formatRelativeTime(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatEstimatedTime(ms?: number): string {
  if (!ms || ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `~${seconds}s` : `~${Math.round(seconds / 60)}m`;
}

export function formatOrigin(origin?: "copilot" | "user" | "automatic"): string {
  switch (origin) {
    case "copilot":
      return "Copilot";
    case "user":
      return "User";
    case "automatic":
      return "Automatic";
    default:
      return "—";
  }
}
