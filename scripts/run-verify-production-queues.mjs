#!/usr/bin/env node
import { runScript } from "./run-performance-script.mjs";

const result = runScript("scripts/verify-production-queues.ts");
process.exit(result.status ?? 1);
