/**
 * Test SSE stream for stack overflow error event (server-side).
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

async function getSession() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, adminKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "mohamedeldesouky@thinkwaymedia.com",
  });
  if (linkError) throw linkError;
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (error) throw error;
  return data.session;
}

function parseSseEvents(text) {
  const events = [];
  for (const block of text.split("\n\n")) {
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
        events.push({ event, data: data.slice(0, 200) });
      }
    }
  }
  return events;
}

async function main() {
  const session = await getSession();
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const cookie = `sb-${projectRef}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;

  console.log("Sending BabyJoy message...");
  const response = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ message: BABYJOY_MSG }),
  });

  if (!response.ok) {
    console.error("HTTP", response.status, await response.text());
    process.exit(1);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const allEvents = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const events = parseSseEvents(part + "\n\n");
      for (const e of events) {
        allEvents.push(e);
        if (e.event === "error") {
          console.log("\n!!! SSE ERROR EVENT !!!");
          console.log(JSON.stringify(e.data, null, 2));
        }
        if (e.event === "done") {
          console.log("\nSSE done event received");
          console.log("workflowMetadata keys:", Object.keys(e.data.workflowMetadata ?? e.data));
        }
        if (e.event === "workflow_progress") {
          process.stdout.write(".");
        }
      }
    }
  }

  const errors = allEvents.filter((e) => e.event === "error");
  const overflow = errors.some((e) =>
    String(e.data?.message ?? e.data).includes("Maximum call stack")
  );

  console.log(`\n\nTotal events: ${allEvents.length}`);
  console.log(`Error events: ${errors.length}`);
  console.log(`Stack overflow in SSE: ${overflow}`);

  if (errors.length) {
    console.log("\nAll error events:");
    for (const e of errors) console.log(JSON.stringify(e.data));
  }

  const eventTypes = {};
  for (const e of allEvents) eventTypes[e.event] = (eventTypes[e.event] ?? 0) + 1;
  console.log("\nEvent type counts:", eventTypes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
