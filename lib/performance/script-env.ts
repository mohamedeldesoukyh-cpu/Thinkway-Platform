import { existsSync } from "node:fs";
import dns from "node:dns/promises";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Env files loaded in order; later files override earlier values on conflict. */
export const SCRIPT_ENV_RELATIVE_PATHS = [
  ".env.local",
  ".env",
  "services/discovery-worker/.env",
] as const;

export type ScriptEnvFileEntry = {
  relative: string;
  path: string;
  found: boolean;
  loaded: boolean;
};

export type ScriptEnvLoadResult = {
  root: string;
  files: ScriptEnvFileEntry[];
};

export type ConnectivityProbeResult = {
  probe: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
  error?: {
    message: string;
    code?: string;
    cause?: string;
    stack?: string;
  };
};

export type ConnectivityRootCauseCategory =
  | "dns"
  | "tls_certificate"
  | "firewall"
  | "ipv6"
  | "node_fetch"
  | "supabase_outage"
  | "ok"
  | "unknown";

export type SupabaseConnectivityReport = {
  supabaseUrl: string;
  hostname: string;
  origin: string;
  restProbeUrl: string;
  nodeVersion: string;
  probes: ConnectivityProbeResult[];
  category: ConnectivityRootCauseCategory;
  remediation: string[];
};

let lastEnvLoad: ScriptEnvLoadResult | null = null;

export function getProjectRoot(): string {
  return path.dirname(fileURLToPath(import.meta.url)) + "/../..";
}

export function getScriptEnvFilePaths(root = getProjectRoot()): string[] {
  return SCRIPT_ENV_RELATIVE_PATHS.map((rel) => path.join(root, rel));
}

export function formatEnvSearchMessage(result: ScriptEnvLoadResult): string {
  const lines = result.files.map((entry) => {
    const status = !entry.found ? "not found" : entry.loaded ? "loaded" : "found, not loaded";
    return `  - ${entry.path} (${status})`;
  });
  return [
    "Searched env files (in order; last loaded wins on conflict):",
    ...lines,
  ].join("\n");
}

export function loadScriptEnv(root = getProjectRoot()): ScriptEnvLoadResult {
  const files: ScriptEnvFileEntry[] = [];

  for (const relative of SCRIPT_ENV_RELATIVE_PATHS) {
    const filePath = path.join(root, relative);
    const found = existsSync(filePath);
    let loaded = false;
    if (found) {
      config({ path: filePath, override: true });
      loaded = true;
    }
    files.push({ relative, path: filePath, found, loaded });
  }

  lastEnvLoad = { root, files };
  return lastEnvLoad;
}

export function getLastScriptEnvLoad(): ScriptEnvLoadResult | null {
  return lastEnvLoad;
}

export function requireScriptEnvVars(
  names: readonly string[],
  options?: { root?: string }
): void {
  if (!lastEnvLoad || (options?.root && lastEnvLoad.root !== options.root)) {
    loadScriptEnv(options?.root ?? getProjectRoot());
  }

  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length === 0) return;

  const load = lastEnvLoad!;
  const label =
    missing.length === 1
      ? `Missing required environment variable: ${missing[0]}`
      : `Missing required environment variables: ${missing.join(", ")}`;

  throw new Error(`${label}\n\n${formatEnvSearchMessage(load)}`);
}

export function getScriptSupabaseUrl(): string {
  requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL"]);
  return process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
}

/** REST URL used by auditMetricsIntegrity (campaign_publications metrics scan). */
export function getMetricsAuditRestUrl(supabaseUrl = getScriptSupabaseUrl()): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const select =
    "id,campaign_header_id,views,likes,comments,shares,saves,engagements,engagement_rate";
  return `${base}/rest/v1/campaign_publications?select=${encodeURIComponent(select)}&content_url=not.is.null`;
}

export function createScriptSupabase(): SupabaseClient {
  requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serializeErrorCause(error: unknown, maxDepth = 4): string[] {
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;

  while (current instanceof Error && depth < maxDepth) {
    const code = (current as NodeJS.ErrnoException).code;
    const line = code ? `${current.message} (code=${code})` : current.message;
    parts.push(line);
    current = current.cause;
    depth += 1;
  }

  if (current != null && !(current instanceof Error)) {
    parts.push(String(current));
  }

  return parts;
}

/** Extract URL, hostname, cause chain, code, and stack from fetch/network errors. */
export function formatFetchErrorDetails(error: unknown, contextUrl?: string): string {
  const lines: string[] = [];

  if (!(error instanceof Error)) {
    return String(error);
  }

  lines.push(`message: ${error.message}`);

  const code = (error as NodeJS.ErrnoException).code;
  if (code) lines.push(`code: ${code}`);

  const url = contextUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    lines.push(`url: ${url}`);
    try {
      lines.push(`hostname: ${new URL(url).hostname}`);
    } catch {
      lines.push("hostname: (invalid URL)");
    }
  }

  if (error.cause != null) {
    lines.push(`cause chain: ${serializeErrorCause(error.cause).join(" → ")}`);
    if (error.cause instanceof Error) {
      const causeCode = (error.cause as NodeJS.ErrnoException).code;
      if (causeCode) lines.push(`error.cause.code: ${causeCode}`);
      lines.push(`error.cause: ${error.cause.message}`);
    } else {
      lines.push(`error.cause: ${String(error.cause)}`);
    }
  }

  if (error.stack) {
    lines.push(`stack:\n${error.stack}`);
  }

  return lines.join("\n");
}

function classifyConnectivityFailure(
  probes: ConnectivityProbeResult[]
): { category: ConnectivityRootCauseCategory; remediation: string[] } {
  const dnsProbe = probes.find((p) => p.probe === "dns.lookup");
  const tlsProbe = probes.find((p) => p.probe === "tls.handshake");
  const fetchOrigin = probes.find((p) => p.probe === "fetch.origin");
  const fetchRest = probes.find((p) => p.probe === "fetch.rest");
  const ipv6Probe = probes.find((p) => p.probe === "dns.lookup.ipv6");

  if (dnsProbe && !dnsProbe.ok) {
    return {
      category: "dns",
      remediation: [
        "Verify DNS resolution for the Supabase hostname (nslookup or Resolve-DnsName).",
        "Check VPN, corporate DNS, or hosts-file overrides.",
        "Confirm NEXT_PUBLIC_SUPABASE_URL matches your Supabase project dashboard.",
      ],
    };
  }

  const tlsCode = tlsProbe?.error?.code ?? "";
  const fetchCauseCode = fetchOrigin?.error?.cause ?? fetchRest?.error?.cause ?? "";
  const certFailure =
    tlsCode.includes("UNABLE_TO_VERIFY") ||
    tlsCode.includes("CERT") ||
    fetchCauseCode.includes("UNABLE_TO_VERIFY") ||
    fetchCauseCode.includes("CERT");

  if (tlsProbe && !tlsProbe.ok && certFailure) {
    return {
      category: "tls_certificate",
      remediation: [
        "Node.js cannot verify the TLS certificate chain (common with corporate SSL inspection).",
        "On Node 22+, run CLI scripts with: NODE_OPTIONS=--use-system-ca",
        "Install your organisation root CA into the Windows trust store, or set NODE_EXTRA_CA_CERTS to the PEM file.",
        "Browsers and some workers may still work because they use the OS certificate store by default.",
      ],
    };
  }

  if (tlsProbe && !tlsProbe.ok) {
    return {
      category: "tls_certificate",
      remediation: [
        "TLS handshake to Supabase failed.",
        "Check proxy/firewall SSL inspection and certificate trust.",
        "Try NODE_OPTIONS=--use-system-ca on Node 22+.",
      ],
    };
  }

  const hasIpv6Records = ipv6Probe?.detail?.includes("ipv6_count=") &&
    !ipv6Probe.detail.includes("ipv6_count=0");
  if (ipv6Probe && !ipv6Probe.ok && dnsProbe?.ok && hasIpv6Records) {
    return {
      category: "ipv6",
      remediation: [
        "IPv6 resolution or connectivity failed while IPv4 succeeded.",
        "Disable broken IPv6 routes, or prefer IPv4 in Node (NODE_OPTIONS=--dns-result-order=ipv4first).",
      ],
    };
  }

  const networkCodes = ["ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND"];
  const fetchCode = fetchOrigin?.error?.code ?? fetchRest?.error?.code ?? "";
  const fetchCause = fetchOrigin?.error?.cause ?? fetchRest?.error?.cause ?? "";
  if (networkCodes.some((c) => fetchCode.includes(c) || fetchCause.includes(c))) {
    return {
      category: "firewall",
      remediation: [
        "Outbound HTTPS to Supabase is blocked or timing out.",
        "Allow *.supabase.co:443 through firewall/VPN.",
        "Confirm no proxy is misconfigured for Node (HTTP_PROXY / HTTPS_PROXY).",
      ],
    };
  }

  const restStatus = fetchRest?.detail?.match(/HTTP (\d+)/)?.[1];
  if (restStatus && Number(restStatus) >= 500) {
    return {
      category: "supabase_outage",
      remediation: [
        "Supabase REST returned a server error — check https://status.supabase.com.",
        "Retry after the incident resolves.",
      ],
    };
  }

  if ((fetchOrigin && !fetchOrigin.ok) || (fetchRest && !fetchRest.ok)) {
    return {
      category: "node_fetch",
      remediation: [
        "Node fetch failed after DNS/TLS checks — inspect error.cause above.",
        "Compare with browser access to the same Supabase URL.",
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are from the same project.",
      ],
    };
  }

  if (dnsProbe?.ok && tlsProbe?.ok && fetchOrigin?.ok && fetchRest?.ok) {
    return { category: "ok", remediation: [] };
  }

  return {
    category: "unknown",
    remediation: [
      "Review probe results below and error.cause chain.",
      "Run: npm run audit:metrics (diagnostics print on failure).",
    ],
  };
}

async function runProbe(
  probe: string,
  fn: () => Promise<{ ok: boolean; detail?: string }>
): Promise<ConnectivityProbeResult> {
  const started = Date.now();
  try {
    const result = await fn();
    return {
      probe,
      ok: result.ok,
      durationMs: Date.now() - started,
      detail: result.detail,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const cause = err.cause instanceof Error ? err.cause.message : err.cause != null ? String(err.cause) : undefined;
    return {
      probe,
      ok: false,
      durationMs: Date.now() - started,
      error: {
        message: err.message,
        code: (err as NodeJS.ErrnoException).code ?? (err.cause as NodeJS.ErrnoException | undefined)?.code,
        cause,
        stack: err.stack,
      },
    };
  }
}

/** DNS, TLS, and fetch probes against the configured Supabase URL. */
export async function diagnoseSupabaseConnectivity(options?: {
  supabaseUrl?: string;
  timeoutMs?: number;
}): Promise<SupabaseConnectivityReport> {
  const supabaseUrl = (options?.supabaseUrl ?? getScriptSupabaseUrl()).trim();
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const parsed = new URL(supabaseUrl);
  const hostname = parsed.hostname;
  const port = Number(parsed.port) || 443;
  const restProbeUrl = getMetricsAuditRestUrl(supabaseUrl);

  const probes: ConnectivityProbeResult[] = [];

  probes.push(
    await runProbe("dns.lookup", async () => {
      const addrs = await dns.lookup(hostname, { all: true });
      const ipv4 = addrs.filter((a) => a.family === 4);
      const ipv6 = addrs.filter((a) => a.family === 6);
      return {
        ok: addrs.length > 0,
        detail: `addresses=${addrs.map((a) => `${a.address} (IPv${a.family === 6 ? 6 : 4})`).join(", ")}; ipv4=${ipv4.length}; ipv6=${ipv6.length}`,
      };
    })
  );

  probes.push(
    await runProbe("dns.lookup.ipv6", async () => {
      try {
        const addrs = await dns.lookup(hostname, { all: true, verbatim: true });
        const ipv6 = addrs.filter((a) => a.family === 6);
        return { ok: ipv6.length > 0, detail: `ipv6_count=${ipv6.length}` };
      } catch {
        return { ok: false, detail: "no IPv6 addresses" };
      }
    })
  );

  probes.push(
    await runProbe("tls.handshake", async () => {
      await new Promise<void>((resolve, reject) => {
        const socket = tls.connect(
          { host: hostname, port, servername: hostname, timeout: timeoutMs },
          () => {
            const authorized = socket.authorized;
            socket.end();
            if (!authorized) {
              reject(new Error("TLS connected but certificate not authorized"));
              return;
            }
            resolve();
          }
        );
        socket.on("error", reject);
        socket.on("timeout", () => {
          socket.destroy();
          reject(Object.assign(new Error("TLS handshake timeout"), { code: "ETIMEDOUT" }));
        });
      });
      return { ok: true, detail: `host=${hostname}:${port}` };
    })
  );

  for (const [probe, target, withAuth] of [
    ["fetch.origin", supabaseUrl, false],
    ["fetch.rest", restProbeUrl, true],
  ] as const) {
    probes.push(
      await runProbe(probe, async () => {
        const headers: Record<string, string> = {};
        if (withAuth) {
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
          headers.apikey = key;
          headers.Authorization = `Bearer ${key}`;
        }
        const response = await fetch(target, {
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
        return {
          ok: response.ok || response.status === 401 || response.status === 404,
          detail: `HTTP ${response.status} ${response.statusText}`,
        };
      })
    );
  }

  const { category, remediation } = classifyConnectivityFailure(probes);

  return {
    supabaseUrl,
    hostname,
    origin: parsed.origin,
    restProbeUrl,
    nodeVersion: process.version,
    probes,
    category,
    remediation,
  };
}

export function formatConnectivityReport(report: SupabaseConnectivityReport): string {
  const lines = [
    `Node: ${report.nodeVersion}`,
    `Supabase origin: ${report.origin}`,
    `Hostname: ${report.hostname}`,
    `Metrics audit REST URL: ${report.restProbeUrl}`,
    `Root cause category: ${report.category}`,
    "",
    "Probes:",
  ];

  for (const probe of report.probes) {
    const status = probe.ok ? "OK" : "FAIL";
    lines.push(`  [${status}] ${probe.probe} (${probe.durationMs}ms)`);
    if (probe.detail) lines.push(`        ${probe.detail}`);
    if (probe.error) {
      lines.push(`        error: ${probe.error.message}`);
      if (probe.error.code) lines.push(`        code: ${probe.error.code}`);
      if (probe.error.cause) lines.push(`        cause: ${probe.error.cause}`);
    }
  }

  if (report.remediation.length > 0) {
    lines.push("", "Remediation:");
    for (const step of report.remediation) {
      lines.push(`  - ${step}`);
    }
  }

  return lines.join("\n");
}

/** Unwrap nested fetch / network errors for CLI scripts. */
export function formatScriptError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const parts = [error.message];
  const causeLines = serializeErrorCause(error.cause);
  for (const line of causeLines) {
    parts.push(`  caused by: ${line}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url && error.message.includes("fetch failed")) {
    parts.push("", formatFetchErrorDetails(error, url));
    try {
      const host = new URL(url).host;
      parts.push(
        `  hint: Supabase REST request to ${host} failed. Verify NEXT_PUBLIC_SUPABASE_URL and network access (CLI scripts use the service-role key directly — no localhost HTTP).`
      );
      parts.push(`  metrics audit URL: ${getMetricsAuditRestUrl(url)}`);
    } catch {
      parts.push(
        "  hint: Supabase REST request failed. Verify NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
  }

  return parts.join("\n");
}

/** formatScriptError plus async connectivity diagnostics (for CLI catch blocks). */
export async function formatScriptErrorWithDiagnostics(error: unknown): Promise<string> {
  const base = formatScriptError(error);
  if (!(error instanceof Error) || !error.message.includes("fetch failed")) {
    return base;
  }

  try {
    const report = await diagnoseSupabaseConnectivity();
    return `${base}\n\n=== Connectivity Diagnostics ===\n${formatConnectivityReport(report)}`;
  } catch (diagError) {
    const detail = diagError instanceof Error ? diagError.message : String(diagError);
    return `${base}\n\n(Connectivity diagnostics failed: ${detail})`;
  }
}

export function parseCliArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg === "--all") {
      out.all = true;
      continue;
    }
    const match = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (!match) continue;
    const [, key, value] = match;
    out[key] = value ?? true;
  }
  return out;
}
