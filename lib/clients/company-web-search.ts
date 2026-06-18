export const WEB_SEARCH_RESULT_LIMIT = 10;

/** Max characters kept per snippet for classification corpus. */
export const WEB_SEARCH_SNIPPET_MAX_CHARS = 600;

export type WebSearchProvider = "serper" | "brave" | "tavily" | "none";

export type CompanyWebSearchContext = {
  snippets: string[];
  linkedInSnippets: string[];
  companyDescriptions: string[];
  extractedWebsite: string | null;
  source: WebSearchProvider;
  apiKeyMissing?: boolean;
};

type WebSearchResult = {
  snippets: string[];
  urls: string[];
  source: WebSearchProvider;
  apiKeyMissing?: boolean;
};

function normalizeSnippets(snippets: string[]): string[] {
  return snippets
    .map((snippet) => snippet.trim().slice(0, WEB_SEARCH_SNIPPET_MAX_CHARS))
    .filter(Boolean);
}

const GENERIC_DOMAINS = new Set([
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
  "wikipedia.org",
  "linkedin.com",
  "crunchbase.com",
  "bloomberg.com",
  "reuters.com",
]);

function hostnameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function extractWebsiteFromSearchUrls(
  urls: string[],
  companyName: string
): string | null {
  const nameTokens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

  let best: { url: string; score: number } | null = null;

  for (const rawUrl of urls) {
    const hostname = hostnameFromUrl(rawUrl);
    if (!hostname || GENERIC_DOMAINS.has(hostname)) {
      continue;
    }

    let score = 1;
    for (const token of nameTokens) {
      if (hostname.includes(token)) {
        score += 3;
      }
    }
    if (hostname.endsWith(".com") || hostname.endsWith(".co")) {
      score += 1;
    }

    if (!best || score > best.score) {
      best = { url: rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`, score };
    }
  }

  return best?.url ?? null;
}

export function hasWebSearchApiKey(): boolean {
  return Boolean(
    process.env.SERPER_API_KEY?.trim() ||
      process.env.BRAVE_SEARCH_API_KEY?.trim() ||
      process.env.TAVILY_API_KEY?.trim()
  );
}

async function searchWithSerper(
  query: string,
  apiKey: string
): Promise<{ snippets: string[]; urls: string[] }> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: WEB_SEARCH_RESULT_LIMIT }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Serper search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    organic?: { title?: string; snippet?: string; link?: string }[];
    knowledgeGraph?: { title?: string; description?: string; type?: string; website?: string };
  };

  const snippets: string[] = [];
  const urls: string[] = [];

  if (data.knowledgeGraph) {
    snippets.push(
      [data.knowledgeGraph.title, data.knowledgeGraph.type, data.knowledgeGraph.description]
        .filter(Boolean)
        .join(" — ")
    );
    if (data.knowledgeGraph.website) {
      urls.push(data.knowledgeGraph.website);
    }
  }
  for (const item of data.organic ?? []) {
    snippets.push([item.title, item.snippet].filter(Boolean).join(" — "));
    if (item.link) {
      urls.push(item.link);
    }
  }
  return {
    snippets: normalizeSnippets(snippets),
    urls,
  };
}

async function searchWithBrave(
  query: string,
  apiKey: string
): Promise<{ snippets: string[]; urls: string[] }> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(WEB_SEARCH_RESULT_LIMIT));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Brave search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    web?: { results?: { title?: string; description?: string; url?: string }[] };
  };

  const snippets: string[] = [];
  const urls: string[] = [];
  for (const item of data.web?.results ?? []) {
    snippets.push([item.title, item.description].filter(Boolean).join(" — "));
    if (item.url) {
      urls.push(item.url);
    }
  }

  return {
    snippets: normalizeSnippets(snippets),
    urls,
  };
}

async function searchWithTavily(
  query: string,
  apiKey: string
): Promise<{ snippets: string[]; urls: string[] }> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: WEB_SEARCH_RESULT_LIMIT,
      include_answer: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    answer?: string;
    results?: { title?: string; content?: string; url?: string }[];
  };

  const snippets: string[] = [];
  const urls: string[] = [];
  if (data.answer) {
    snippets.push(data.answer);
  }
  for (const item of data.results ?? []) {
    snippets.push([item.title, item.content].filter(Boolean).join(" — "));
    if (item.url) {
      urls.push(item.url);
    }
  }
  return {
    snippets: normalizeSnippets(snippets),
    urls,
  };
}

async function runWebSearch(query: string): Promise<WebSearchResult> {
  const serperKey = process.env.SERPER_API_KEY?.trim();
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();

  const providers: Array<{
    key: string;
    source: WebSearchProvider;
    search: (query: string, key: string) => Promise<{ snippets: string[]; urls: string[] }>;
  }> = [
    { key: serperKey ?? "", source: "serper", search: searchWithSerper },
    { key: braveKey ?? "", source: "brave", search: searchWithBrave },
    { key: tavilyKey ?? "", source: "tavily", search: searchWithTavily },
  ];

  for (const provider of providers) {
    if (!provider.key) {
      continue;
    }
    try {
      const result = await provider.search(query, provider.key);
      if (result.snippets.length > 0) {
        return { snippets: result.snippets, urls: result.urls, source: provider.source };
      }
    } catch {
      continue;
    }
  }

  if (!serperKey && !braveKey && !tavilyKey) {
    return { snippets: [], urls: [], source: "none", apiKeyMissing: true };
  }

  return { snippets: [], urls: [], source: "none" };
}

export async function searchCompanyOnWeb(query: string): Promise<{
  snippets: string[];
  source: WebSearchProvider;
  apiKeyMissing?: boolean;
}> {
  const result = await runWebSearch(query);
  return {
    snippets: result.snippets,
    source: result.source,
    apiKeyMissing: result.apiKeyMissing,
  };
}

export async function gatherCompanyWebContext(
  companyName: string,
  country?: string | null,
  website?: string | null
): Promise<CompanyWebSearchContext> {
  const mainQuery = buildCompanySearchQuery(companyName, country, website);
  const linkedInQuery = buildLinkedInCompanySearchQuery(companyName, country);
  const descriptionQuery = buildCompanyDescriptionSearchQuery(companyName, country);

  const [main, linkedIn, descriptions] = await Promise.all([
    runWebSearch(mainQuery),
    runWebSearch(linkedInQuery),
    runWebSearch(descriptionQuery),
  ]);

  const source =
    main.source !== "none"
      ? main.source
      : linkedIn.source !== "none"
        ? linkedIn.source
        : descriptions.source;

  const allUrls = [...main.urls, ...linkedIn.urls, ...descriptions.urls];
  const extractedWebsite =
    website?.trim() || extractWebsiteFromSearchUrls(allUrls, companyName);

  const companyDescriptions = normalizeSnippets([
    ...descriptions.snippets,
    ...main.snippets.slice(0, 5),
  ]);

  return {
    snippets: normalizeSnippets(main.snippets),
    linkedInSnippets: normalizeSnippets(linkedIn.snippets),
    companyDescriptions,
    extractedWebsite,
    source,
    apiKeyMissing: main.apiKeyMissing && linkedIn.apiKeyMissing && descriptions.apiKeyMissing,
  };
}

export function buildCompanySearchQuery(
  companyName: string,
  country?: string | null,
  website?: string | null
): string {
  const parts = [companyName.trim()];
  if (website?.trim()) {
    parts.push(website.trim());
  }
  if (country?.trim()) {
    parts.push(country.trim());
  }
  parts.push("company industry products services");
  return parts.filter(Boolean).join(" ");
}

export function buildLinkedInCompanySearchQuery(
  companyName: string,
  country?: string | null
): string {
  const parts = [`"${companyName.trim()}"`, "site:linkedin.com/company"];
  if (country?.trim()) {
    parts.push(country.trim());
  }
  return parts.join(" ");
}

export function buildCompanyDescriptionSearchQuery(
  companyName: string,
  country?: string | null
): string {
  const parts = [companyName.trim(), "about company description"];
  if (country?.trim()) {
    parts.push(country.trim());
  }
  return parts.filter(Boolean).join(" ");
}
