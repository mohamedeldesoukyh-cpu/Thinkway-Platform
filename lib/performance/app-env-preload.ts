/**
 * Loads app env files only (.env.local → .env), matching `npm run dev`.
 * Use for rollout preflight and other scripts that must not inherit
 * services/discovery-worker/.env overrides (e.g. sb_secret_* service keys).
 */
import { loadAppScriptEnv } from "@/lib/performance/script-env";

loadAppScriptEnv();
