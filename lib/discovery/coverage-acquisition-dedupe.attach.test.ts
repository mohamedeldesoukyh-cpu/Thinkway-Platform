import assert from "node:assert/strict";

import {
  attachSearchSessionToCoverageAcquisitionJob,
  findActiveCoverageAcquisitionJob,
} from "./coverage-acquisition-dedupe";

type JobRow = {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function createMockSupabase(jobs: JobRow[]) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            in(_column: string, statuses: string[]) {
              return {
                filter(_path: string, _op: string, key: string) {
                  return {
                    order() {
                      return {
                        limit() {
                          return {
                            async maybeSingle() {
                              const match = jobs.find(
                                (job) =>
                                  statuses.includes(job.status) &&
                                  job.payload.coverageDedupeKey === key
                              );
                              return { data: match ?? null, error: null };
                            },
                          };
                        },
                      };
                    },
                  };
                },
                eq(_column: string, id: string) {
                  return {
                    in(_statusCol: string, statuses: string[]) {
                      return {
                        async maybeSingle() {
                          const match = jobs.find(
                            (job) => job.id === id && statuses.includes(job.status)
                          );
                          return { data: match ?? null, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
            eq(_column: string, id: string) {
              return {
                in(_statusCol: string, statuses: string[]) {
                  return {
                    async maybeSingle() {
                      const match = jobs.find(
                        (job) => job.id === id && statuses.includes(job.status)
                      );
                      return { data: match ?? null, error: null };
                    },
                  };
                },
              };
            },
          };
        },
        update(patch: { payload: Record<string, unknown> }) {
          return {
            eq(_column: string, id: string) {
              return {
                async in(_statusCol: string, statuses: string[]) {
                  const job = jobs.find(
                    (row) => row.id === id && statuses.includes(row.status)
                  );
                  if (job) job.payload = patch.payload;
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  } as never;
}

async function testFindAndAttach() {
  const jobs: JobRow[] = [
    {
      id: "job-1",
      status: "running",
      created_at: "2026-07-23T00:00:00.000Z",
      payload: {
        coverageDedupeKey: "acq:instagram:eg:sports:location:runningegypt",
        searchSessionId: "session-a",
        searchSessionIds: ["session-a"],
        searchId: "search-a",
        searchIds: ["search-a"],
      },
    },
  ];
  const supabase = createMockSupabase(jobs);

  const found = await findActiveCoverageAcquisitionJob(
    supabase,
    "acq:instagram:eg:sports:location:runningegypt"
  );
  assert.ok(found);
  assert.equal(found!.id, "job-1");

  const attached = await attachSearchSessionToCoverageAcquisitionJob(supabase, "job-1", {
    searchSessionId: "session-b",
    searchId: "search-b",
  });
  assert.equal(attached.attached, true);
  assert.equal(attached.alreadyAttached, false);
  assert.deepEqual(attached.searchSessionIds, ["session-a", "session-b"]);
  assert.deepEqual(jobs[0]!.payload.searchSessionIds, ["session-a", "session-b"]);
  assert.deepEqual(jobs[0]!.payload.searchIds, ["search-a", "search-b"]);

  const again = await attachSearchSessionToCoverageAcquisitionJob(supabase, "job-1", {
    searchSessionId: "session-b",
    searchId: "search-b",
  });
  assert.equal(again.attached, true);
  assert.equal(again.alreadyAttached, true);
  assert.equal((jobs[0]!.payload.searchSessionIds as string[]).length, 2);
}

async function run() {
  await testFindAndAttach();
  console.log("lib/discovery/coverage-acquisition-dedupe.attach.test.ts — all tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
