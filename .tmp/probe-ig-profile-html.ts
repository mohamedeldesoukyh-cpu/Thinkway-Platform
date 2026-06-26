#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const url = "https://www.instagram.com/amiryoussef.official/";
  const res = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; ThinkwayBot/1.0)",
    },
  });
  const html = await res.text();
  console.log("status", res.status, "len", html.length);
  const patterns = [
    /"followerCount"\s*:\s*"?([\d,]+)"?/i,
    /([\d,.]+[kmb]?)\s+followers/i,
    /edge_followed_by.*?count.*?(\d+)/i,
    /"userInteractionCount":\s*(\d+)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    console.log(p.toString(), "=>", m?.[1] ?? m?.[0]?.slice(0, 80) ?? null);
  }
  const idx = html.indexOf("follower");
  if (idx >= 0) console.log("context:", html.slice(Math.max(0, idx - 40), idx + 120));
}

main().catch(console.error);
