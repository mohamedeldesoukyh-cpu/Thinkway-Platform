/**
 * Side-effect import: loads CLI env files before any module that reads process.env at import time.
 * Must be the first import in performance CLI scripts (or use tsx --import).
 */
import { loadScriptEnv } from "@/lib/performance/script-env";

loadScriptEnv();
