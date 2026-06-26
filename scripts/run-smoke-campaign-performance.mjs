#!/usr/bin/env node
import { runScript } from "./run-performance-script.mjs";

const result = runScript("scripts/smoke-campaign-performance.ts");
process.exit(result.status ?? 1);
