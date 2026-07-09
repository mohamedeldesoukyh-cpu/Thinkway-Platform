import { getQueueStats } from "@/lib/performance/campaign-performance-queues";
import { DISCOVERY_WORKER_QUEUES } from "@/lib/observability/discovery-queues";
import type { QueueStats } from "@/lib/performance/campaign-performance-queues";

export type DiscoveryQueueReport = {
  configured: boolean;
  queues: QueueStats[];
  totals: {
    active: number;
    waiting: number;
    failed: number;
    delayed: number;
  };
  timestamp: string;
};

export async function getDiscoveryQueueReport(): Promise<DiscoveryQueueReport> {
  const stats = await Promise.all(
    DISCOVERY_WORKER_QUEUES.map((name) => getQueueStats(name))
  );

  const totals = stats.reduce(
    (acc, q) => ({
      active: acc.active + q.active,
      waiting: acc.waiting + q.waiting,
      failed: acc.failed + q.failed,
      delayed: acc.delayed + q.delayed,
    }),
    { active: 0, waiting: 0, failed: 0, delayed: 0 }
  );

  return {
    configured: stats.some((q) => q.available),
    queues: stats,
    totals,
    timestamp: new Date().toISOString(),
  };
}
