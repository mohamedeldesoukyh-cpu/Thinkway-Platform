import type { Worker } from "bullmq";

/** Downgrade expected lock-loss noise when jobs are paused/cancelled or stall-recovered. */
export function attachCreatorImportWorkerEvents(worker: Worker, label: string): void {
  worker.on("lockRenewalFailed", (jobIds: string[]) => {
    console.warn(`[${label}] lock renewal failed for jobs: ${jobIds.join(", ")}`);
  });

  worker.on("error", (err: Error) => {
    if (err.message.startsWith("could not renew lock for job")) {
      console.warn(`[${label}] ${err.message}`);
      return;
    }
    console.error(`[${label}] worker error`, err.message);
  });
}
