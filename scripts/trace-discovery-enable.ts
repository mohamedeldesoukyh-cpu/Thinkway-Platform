/**
 * Side-effect module — enable Discovery search tracing BEFORE any app module is
 * imported (module-level `AI_SEARCH_TRACE_ENABLED` is evaluated at import time).
 * Import this FIRST in the diagnostic script.
 */
process.env.AI_SEARCH_TRACE = process.env.AI_SEARCH_TRACE ?? "1";
process.env.AI_WORKFLOW_TRACE = process.env.AI_WORKFLOW_TRACE ?? "1";
