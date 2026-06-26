#!/usr/bin/env node
import { runScript } from "./run-performance-script.mjs";

const result = runScript("scripts/audit-metrics.ts");
process.exit(result.status ?? 1);
