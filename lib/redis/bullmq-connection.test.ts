import assert from "node:assert/strict";

import IORedis from "ioredis";

import { createBullMqQueueConnection } from "./bullmq-connection";

const URL = "redis://user:secret@queue-host.internal:12999/3";

/**
 * Regression for the producer/consumer Redis mismatch: the web app used
 * `{ connection: { url } }`, which ioredis silently ignores (localhost
 * fallback), while the worker passed the URL string. Producer connection
 * options must resolve to the SAME host/port/db/auth as the worker's
 * `new IORedis(url)` construction.
 */
function testProducerMatchesWorkerConnection(): void {
  // Worker construction (services/discovery-worker/src/queues/connection.ts).
  const worker = new IORedis(URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  // Producer construction (the fix).
  const producer = createBullMqQueueConnection(URL) as {
    host: string;
    port: number;
    db: number;
    username?: string;
    password?: string;
    tls?: object;
  };

  try {
    assert.equal(producer.host, worker.options.host);
    assert.equal(producer.port, worker.options.port);
    assert.equal(producer.db, worker.options.db);
    assert.equal(producer.password, worker.options.password);
    assert.equal(producer.host, "queue-host.internal");
    assert.equal(producer.port, 12999);
    assert.equal(producer.db, 3);
    assert.equal(producer.tls, undefined);

    // rediss:// → TLS enabled.
    const tls = createBullMqQueueConnection("rediss://h:6380/0") as { tls?: object };
    assert.ok(tls.tls);

    // Defaults: no port → 6379, no db path → 0.
    const bare = createBullMqQueueConnection("redis://plainhost") as {
      host: string;
      port: number;
      db: number;
    };
    assert.equal(bare.host, "plainhost");
    assert.equal(bare.port, 6379);
    assert.equal(bare.db, 0);

    // The OLD bug shape: ioredis ignores an { url } options key entirely.
    const buggy = new IORedis({ url: URL, lazyConnect: true } as never);
    assert.equal(buggy.options.host, "localhost");
    assert.equal(buggy.options.port, 6379);
    buggy.disconnect();
  } finally {
    worker.disconnect();
  }
}

function run(): void {
  testProducerMatchesWorkerConnection();
  console.log("bullmq-connection.test.ts: PASS");
}

run();
