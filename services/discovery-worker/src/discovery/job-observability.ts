import { supabase } from "../db/supabase.js";

export type JobLogLevel = "info" | "warn" | "error";

export type JobLogEntry = {
  at: string;
  level: JobLogLevel;
  message: string;
};

export type DiscoveryJobOutcome =
  | "crawl_success"
  | "seeded_fallback"
  | "partial_success"
  | "crawl_blocked"
  | "empty";

export type DiscoveryJobResult = {
  discovered: number;
  profiles_added: number;
  crawl_discovered: number;
  seeded: boolean;
  seed_count: number;
  outcome: DiscoveryJobOutcome;
  crawl_error: string | null;
  usernames: string[];
  logs: JobLogEntry[];
  method?: string;
  platform?: string;
};

export class DiscoveryJobTracker {
  private logs: JobLogEntry[] = [];

  constructor(private readonly jobId?: string) {}

  log(level: JobLogLevel, message: string): void {
    const entry: JobLogEntry = { at: new Date().toISOString(), level, message };
    this.logs.push(entry);
    console.log(`[discovery-job${this.jobId ? `:${this.jobId.slice(0, 8)}` : ""}] ${level}: ${message}`);
  }

  getLogs(): JobLogEntry[] {
    return [...this.logs];
  }

  async patch(patch: Record<string, unknown>): Promise<void> {
    if (!this.jobId) return;
    const { error } = await supabase.from("discovery_jobs").update(patch).eq("id", this.jobId);
    if (error) throw new Error(error.message);
  }

  async markRunning(): Promise<void> {
    this.log("info", "Crawl job started");
    await this.patch({
      status: "running",
      started_at: new Date().toISOString(),
      result: { logs: this.getLogs() },
    });
  }

  async markCompleted(result: DiscoveryJobResult): Promise<void> {
    this.log(
      "info",
      `Job finished — outcome=${result.outcome}, profiles_added=${result.profiles_added}`
    );
    await this.patch({
      status: "completed",
      completed_at: new Date().toISOString(),
      profiles_discovered: result.profiles_added,
      error_message: result.crawl_error,
      result: { ...result, logs: this.getLogs() },
    });
  }

  async markFailed(message: string, partial?: Partial<DiscoveryJobResult>): Promise<void> {
    this.log("error", message);
    await this.patch({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message,
      result: partial
        ? { ...partial, logs: this.getLogs(), outcome: partial.outcome ?? "crawl_blocked" }
        : { logs: this.getLogs(), outcome: "crawl_blocked" },
    });
  }
}
