#!/usr/bin/env node
import { runScript } from "./run-performance-script.mjs";

const result = runScript("scripts/audit-campaign-performance-final.ts");
process.exit(result.status ?? 1);
