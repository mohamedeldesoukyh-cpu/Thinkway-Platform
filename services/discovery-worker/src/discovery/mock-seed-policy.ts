export type MockSeedDecision = {
  attemptSeed: boolean;
  markFailed: boolean;
  failureReason: string | null;
};

export const MOCK_SEED_DISABLED_MESSAGE =
  "Mock seed permanently disabled — discovery worker never inserts mock_seed profiles";

/** Mock-seed is permanently disabled — never auto-insert mock profiles. */
export function isMockSeedFallbackEnabled(
  _env: NodeJS.ProcessEnv = process.env
): boolean {
  return false;
}

/** Whether the discovery worker should run mock-seed or mark the job failed. */
export function resolveMockSeedDecision(input: {
  crawlDiscovered: number;
  demoEnabled: boolean;
  crawlError: string | null;
}): MockSeedDecision {
  if (input.crawlDiscovered > 0) {
    return { attemptSeed: false, markFailed: false, failureReason: null };
  }

  if (input.crawlError) {
    return {
      attemptSeed: false,
      markFailed: true,
      failureReason: input.crawlError,
    };
  }

  return { attemptSeed: false, markFailed: false, failureReason: null };
}
