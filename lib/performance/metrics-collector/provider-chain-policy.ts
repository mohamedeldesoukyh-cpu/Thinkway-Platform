import { hasAnyMetric, isCompleteMetrics } from './merge-metrics';
import type { ProviderAttemptResult } from './types';

/** Only fresh provider results can end a refresh; stored totals cannot. */
export function shouldStopProviderChain(attempt: ProviderAttemptResult): boolean {
 return Boolean(attempt.metrics && (attempt.provider === 'apify'
  ? hasAnyMetric(attempt.metrics) : isCompleteMetrics(attempt.metrics)));
}
