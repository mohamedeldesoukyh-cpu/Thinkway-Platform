import IORedis from "ioredis";

import { config } from "../config.js";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}
