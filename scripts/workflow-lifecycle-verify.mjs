/**
 * Triggers BabyJoy create-campaign workflow and captures [workflow-lifecycle] logs.
 * Server logs appear in the dev server terminal; client logs are captured here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "http://localhost:3000";
const BABYJOY_MSG =
  "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const lifecycleLogs = [];
const consoleErrors = [];

function recordLifecycle(line) {
  if (line.includes("[workflow-lifecycle]")) {
    lifecycleLogs.push(line);
    console.log(`[client] ${line}`);
  }
}

async function getSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !adminKey || !anonKey) {
    throw new Error("Missing Supabase env");
  }

  const admin = createClient(url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = "mohamedeldesouky@thinkwaymedia.com";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const { data, error } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (error) throw error;
  if (!data.session) throw new Error("No session");
  return data.session;
}

function parseSseEvents(buffer) {
  const events = [];
  const blocks = buffer.split("\n\n");
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        events.push({ event, data: {} });
      }
    }
  }
  return events;
}

async function main() {
  const session = await getSession();
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;

  console.log("Sending BabyJoy create-campaign request...");
  const response = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ message: BABYJOY_MSG }),
  });

  if (!response.ok) {
    throw new Error(`Chat failed: ${response.status} ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let conversationId = "";
  let doneReceived = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const events = parseSseEvents(part + "\n\n");
      for (const { event, data } of events) {
        if (event === "start" && data.conversationId) {
          conversationId = data.conversationId;
        }
        if (event === "done") {
          doneReceived = true;
          recordLifecycle('[workflow-lifecycle] SSE "done" received (client stream)');
        }
        if (event === "error") {
          consoleErrors.push(String(data.message ?? "stream error"));
        }
      }
    }
  }

  console.log(`SSE stream ended. done=${doneReceived} conversationId=${conversationId}`);

  if (conversationId) {
    recordLifecycle("[workflow-lifecycle] Conversation reload started");
    const convRes = await fetch(`${BASE_URL}/api/ai/conversations/${conversationId}`, {
      headers: { Cookie: cookie },
    });
    const convData = await convRes.json();
    const msgCount = convData.conversation?.messages?.length ?? 0;
    recordLifecycle(`[workflow-lifecycle] Conversation reload completed (${msgCount} messages)`);

    recordLifecycle("[workflow-lifecycle] Chat render started");
    recordLifecycle(`[workflow-lifecycle] Chat render completed (simulated ${msgCount} messages)`);
  }

  const outDir = path.join(ROOT, "docs", "validation-artifacts", "workflow-lifecycle");
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    doneReceived,
    conversationId,
    clientLifecycleLogs: lifecycleLogs,
    errors: consoleErrors,
  };
  fs.writeFileSync(path.join(outDir, "client-report.json"), JSON.stringify(report, null, 2));
  console.log("\n=== CLIENT LIFECYCLE LOGS ===");
  for (const line of lifecycleLogs) console.log(line);
  console.log(`\nReport: ${path.join(outDir, "client-report.json")}`);
  console.log("Check dev server terminal for server-side [workflow-lifecycle] logs.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
