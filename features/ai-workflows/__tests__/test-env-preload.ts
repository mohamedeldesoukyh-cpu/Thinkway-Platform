/**
 * Test-only env preload — import FIRST. The workflow engine's import graph
 * reads Supabase env vars at module load; dry-run engine tests never open a
 * connection, so placeholders satisfy the loader without touching any service.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

export {};
