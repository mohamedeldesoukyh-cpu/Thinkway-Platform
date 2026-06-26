import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(workerDir, "../..");

// Root app secrets first, then worker-local overrides.
loadEnv({ path: path.join(repoRoot, ".env") });
loadEnv({ path: path.join(repoRoot, ".env.local") });
loadEnv({ path: path.join(workerDir, ".env") });
loadEnv({ path: path.join(workerDir, ".env.local") });
