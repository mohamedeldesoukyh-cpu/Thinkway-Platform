import IORedis from "ioredis";

import { config } from "../config.js";

/** BullMQ workers need dedicated blocking connections — do not share one client. */
export function getRedisConnection(): IORedis {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
