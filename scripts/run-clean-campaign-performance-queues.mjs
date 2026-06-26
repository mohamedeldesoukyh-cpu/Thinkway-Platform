#!/usr/bin/env node
import { runScript } from "./run-performance-script.mjs";

const result = runScript("scripts/clean-campaign-performance-queues.ts");
process.exit(result.status ?? 1);
